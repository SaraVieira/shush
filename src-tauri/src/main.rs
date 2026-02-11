#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    ActivationPolicy, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_positioner::{on_tray_event, Position, WindowExt};
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[tauri::command]
fn list_audio_devices() -> Vec<audio::AudioDeviceInfo> {
    audio::list_devices()
}

#[tauri::command]
fn start_audio(app_handle: tauri::AppHandle, device_name: Option<String>) {
    audio::start_monitoring(app_handle, device_name);
}

#[tauri::command]
fn set_threshold(value: i32) {
    audio::set_threshold(value);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_positioner::init())
        .invoke_handler(tauri::generate_handler![
            list_audio_devices,
            start_audio,
            set_threshold
        ])
        .setup(|app| {
            // Hide dock icon, keep menu bar only
            app.set_activation_policy(ActivationPolicy::Accessory);

            let app_handle = app.handle();
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::HudWindow,
                    Some(NSVisualEffectState::Active),
                    None,
                );
            }
            let show = MenuItemBuilder::new("Open Shush").id("show").build(app)?;
            let quit = MenuItemBuilder::new("Quit").id("quit").build(app)?;
            let tray_menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .icon_as_template(true)
                .show_menu_on_left_click(false)
                .menu(&tray_menu);
            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            let handle_for_tray = app_handle.clone();
            let handle_for_menu = app_handle.clone();
            let handle_for_focus = app_handle.clone();

            tray_builder
                .on_tray_icon_event(move |_tray, event| {
                    on_tray_event(&handle_for_tray, &event);
                    match event {
                        TrayIconEvent::Click { .. } | TrayIconEvent::DoubleClick { .. } => {
                            if let Some(window) = handle_for_tray.get_webview_window("main") {
                                let _ = window.move_window(Position::TrayCenter);
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_menu_event(move |_app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = handle_for_menu.get_webview_window("main") {
                            let _ = window.move_window(Position::TrayCenter);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        handle_for_menu.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            if let Some(window) = handle_for_focus.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let WindowEvent::Focused(false) = event {
                        if let Some(win) = handle_for_focus.get_webview_window("main") {
                            let _ = win.hide();
                        }
                    }
                });
            }

            // Auto-start audio monitoring
            let audio_handle = app.handle().clone();
            audio::start_monitoring(audio_handle, None);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
