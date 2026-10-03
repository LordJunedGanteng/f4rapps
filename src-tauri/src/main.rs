// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|panic_info| {
        let msg = format!("PANIC: {}\n", panic_info);
        let _ = std::fs::write("tauri_crash.txt", msg);
    }));
    app_lib::run();
}
