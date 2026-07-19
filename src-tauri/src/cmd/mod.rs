pub mod config;
pub mod general;
pub mod mcp;
pub mod raw3d;

use std::fmt::Display;

pub type CmdResult<T = ()> = Result<T, String>;

pub trait StringifyErr<T> {
    fn stringify_err(self) -> CmdResult<T>;
}

impl<T, E: Display> StringifyErr<T> for Result<T, E> {
    fn stringify_err(self) -> CmdResult<T> {
        self.map_err(|e| e.to_string())
    }
}
