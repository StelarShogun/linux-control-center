use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("validation error: {0}")]
    Validation(String),

    #[error("profile serialization error: {0}")]
    ProfileSerialization(String),

    #[error("profile deserialization error: {0}")]
    ProfileDeserialization(String),

    #[error("snapshot not found: {0}")]
    SnapshotNotFound(String),
}
