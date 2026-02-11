use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct DbPayload {
    db: i32,
}

#[derive(Clone, Serialize)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub label: String,
}

static SMOOTH_ALPHA: f64 = 0.15;
static THRESHOLD: AtomicI32 = AtomicI32::new(65);

/// Shared stop flag — set to true to signal the current monitoring thread to exit.
fn stop_flag() -> &'static Arc<AtomicBool> {
    static FLAG: OnceLock<Arc<AtomicBool>> = OnceLock::new();
    FLAG.get_or_init(|| Arc::new(AtomicBool::new(false)))
}

pub fn set_threshold(value: i32) {
    THRESHOLD.store(value, Ordering::Relaxed);
}

struct DotIcons {
    green: Vec<u8>,
    amber: Vec<u8>,
    red: Vec<u8>,
}

fn cached_icons() -> &'static DotIcons {
    static ICONS: OnceLock<DotIcons> = OnceLock::new();
    ICONS.get_or_init(|| DotIcons {
        green: generate_dot_rgba(52, 199, 89),
        amber: generate_dot_rgba(255, 159, 10),
        red: generate_dot_rgba(255, 59, 48),
    })
}

fn generate_dot_rgba(r: u8, g: u8, b: u8) -> Vec<u8> {
    let size: u32 = 22;
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let center = size as f32 / 2.0;
    let radius = 8.0f32;

    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center + 0.5;
            let dy = y as f32 - center + 0.5;
            let dist = (dx * dx + dy * dy).sqrt();
            let idx = ((y * size + x) * 4) as usize;

            if dist <= radius + 0.5 {
                let alpha = if dist > radius - 0.5 {
                    ((radius + 0.5 - dist) * 255.0) as u8
                } else {
                    255
                };
                rgba[idx] = r;
                rgba[idx + 1] = g;
                rgba[idx + 2] = b;
                rgba[idx + 3] = alpha;
            }
        }
    }
    rgba
}

struct MonitorState {
    smoothed: Option<f64>,
    last_emitted: Option<i32>,
    last_icon_state: String,
}

fn process_rms(rms: f64, state: &Mutex<MonitorState>, app: &AppHandle) {
    let raw_db = (20.0 * rms.max(1e-8).log10() + 90.0).max(0.0);

    let mut st = match state.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    let smoothed = match st.smoothed {
        Some(prev) => prev + SMOOTH_ALPHA * (raw_db - prev),
        None => raw_db,
    };
    st.smoothed = Some(smoothed);
    let rounded = smoothed.round() as i32;

    if st.last_emitted != Some(rounded) {
        st.last_emitted = Some(rounded);
        let _ = app.emit("db-level", DbPayload { db: rounded });
    }

    // Update tray icon color based on threshold
    let threshold = THRESHOLD.load(Ordering::Relaxed);
    let icon_state = if rounded >= threshold {
        "red"
    } else if rounded >= threshold - 5 {
        "amber"
    } else {
        "green"
    };

    if st.last_icon_state != icon_state {
        st.last_icon_state = icon_state.to_string();
        if let Some(tray) = app.tray_by_id("main-tray") {
            let icons = cached_icons();
            let rgba = match icon_state {
                "red" => &icons.red,
                "amber" => &icons.amber,
                _ => &icons.green,
            };
            let icon = tauri::image::Image::new(rgba, 22, 22);
            let _ = tray.set_icon(Some(icon));
            let _ = tray.set_icon_as_template(false);
        }
    }
}

pub fn list_devices() -> Vec<AudioDeviceInfo> {
    let host = cpal::default_host();
    let mut devices = Vec::new();
    if let Ok(input_devices) = host.input_devices() {
        for device in input_devices {
            let label = device.name().unwrap_or_default();
            devices.push(AudioDeviceInfo {
                id: label.clone(),
                label,
            });
        }
    }
    devices
}

pub fn start_monitoring(app_handle: AppHandle, device_name: Option<String>) {
    // Signal any previous monitoring thread to stop
    stop_flag().store(true, Ordering::SeqCst);
    std::thread::sleep(std::time::Duration::from_millis(150));
    stop_flag().store(false, Ordering::SeqCst);

    std::thread::spawn(move || {
        let stop = stop_flag().clone();
        let host = cpal::default_host();

        let device = if let Some(ref name) = device_name {
            host.input_devices()
                .ok()
                .and_then(|mut devices| devices.find(|d| d.name().ok().as_deref() == Some(name)))
                .or_else(|| host.default_input_device())
        } else {
            host.default_input_device()
        };

        let device = match device {
            Some(d) => d,
            None => {
                let _ = app_handle.emit("audio-error", "No input device found");
                return;
            }
        };

        let config = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                let _ = app_handle.emit("audio-error", format!("Config error: {}", e));
                return;
            }
        };

        let channels = config.channels() as usize;
        let state = Arc::new(Mutex::new(MonitorState {
            smoothed: None,
            last_emitted: None,
            last_icon_state: String::new(),
        }));

        let err_fn = {
            let app = app_handle.clone();
            move |err: cpal::StreamError| {
                let _ = app.emit("audio-error", format!("Stream error: {}", err));
            }
        };

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => {
                let state = state.clone();
                let app = app_handle.clone();
                device.build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        let sum: f64 = data
                            .chunks(channels)
                            .map(|frame| {
                                let mono =
                                    frame.iter().map(|&s| s as f64).sum::<f64>() / channels as f64;
                                mono * mono
                            })
                            .sum();
                        let count = data.len() / channels;
                        let rms = (sum / count as f64).sqrt();
                        process_rms(rms, &state, &app);
                    },
                    err_fn,
                    None,
                )
            }
            cpal::SampleFormat::I16 => {
                let state = state.clone();
                let app = app_handle.clone();
                device.build_input_stream(
                    &config.into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let sum: f64 = data
                            .chunks(channels)
                            .map(|frame| {
                                let mono = frame
                                    .iter()
                                    .map(|&s| s as f64 / i16::MAX as f64)
                                    .sum::<f64>()
                                    / channels as f64;
                                mono * mono
                            })
                            .sum();
                        let count = data.len() / channels;
                        let rms = (sum / count as f64).sqrt();
                        process_rms(rms, &state, &app);
                    },
                    {
                        let app = app_handle.clone();
                        move |err: cpal::StreamError| {
                            let _ = app.emit("audio-error", format!("Stream error: {}", err));
                        }
                    },
                    None,
                )
            }
            _ => {
                let _ = app_handle.emit("audio-error", "Unsupported sample format");
                return;
            }
        };

        let stream = match stream {
            Ok(s) => s,
            Err(e) => {
                let _ = app_handle.emit("audio-error", format!("Failed to build stream: {}", e));
                return;
            }
        };

        if let Err(e) = stream.play() {
            let _ = app_handle.emit("audio-error", format!("Failed to play stream: {}", e));
            return;
        }

        let _ = app_handle.emit("audio-started", ());

        // Keep thread alive until stop is signalled
        while !stop.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        // Stream is dropped here, releasing the microphone
    });
}
