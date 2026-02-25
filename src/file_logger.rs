use anyhow::{Context, Result};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug)]
pub struct FileLogger {
    debug_enabled: bool,
    file: Option<Mutex<File>>,
}

impl FileLogger {
    pub fn new(debug_enabled: bool, log_path: Option<PathBuf>) -> Result<Self> {
        let file = if let Some(path) = log_path {
            Some(Mutex::new(open_log_file(&path)?))
        } else {
            None
        };

        Ok(Self {
            debug_enabled,
            file,
        })
    }

    pub fn info(&self, message: &str) {
        self.write_line("INFO", message);
    }

    pub fn debug(&self, message: &str) {
        if self.debug_enabled {
            self.write_line("DEBUG", message);
        }
    }

    fn write_line(&self, level: &str, message: &str) {
        let line = format!("[{level}] {message}\n");
        eprint!("{line}");

        if let Some(file) = &self.file
            && let Ok(mut guard) = file.lock()
        {
            let _ = guard.write_all(line.as_bytes());
            let _ = guard.flush();
        }
    }
}

fn open_log_file(path: &Path) -> Result<File> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create log directory: {}", parent.display()))?;
    }

    OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
        .with_context(|| format!("failed to open log file: {}", path.display()))
}
