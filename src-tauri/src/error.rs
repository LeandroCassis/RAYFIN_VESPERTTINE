//! Error type for fallible Tauri commands. Serializes to a plain string so the
//! JS `invoke(...)` promise rejects with a readable message.

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
  #[error("{0}")]
  Msg(String),
}

impl Serialize for AppError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    serializer.serialize_str(&self.to_string())
  }
}

impl From<anyhow::Error> for AppError {
  fn from(e: anyhow::Error) -> Self {
    AppError::Msg(e.to_string())
  }
}

impl From<std::io::Error> for AppError {
  fn from(e: std::io::Error) -> Self {
    AppError::Msg(e.to_string())
  }
}

impl From<String> for AppError {
  fn from(e: String) -> Self {
    AppError::Msg(e)
  }
}

impl From<&str> for AppError {
  fn from(e: &str) -> Self {
    AppError::Msg(e.to_string())
  }
}

pub type AppResult<T> = Result<T, AppError>;
