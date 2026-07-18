use anyhow::bail;
use bytes::Bytes;

/// A grayscale mask (u8 per pixel) with spatial dimensions.
/// Used for injecting mask data into voxel buffers.
#[derive(Debug, Clone)]
pub struct Mask {
    pub data: Bytes,
    pub height: usize,
    pub width: usize,
}

impl Mask {
    /// Create a new mask from raw pixel data.
    ///
    /// # Errors
    ///
    /// Returns an error if `data.len()` is not a positive multiple of `height * width`.
    pub fn new(data: Bytes, height: usize, width: usize) -> anyhow::Result<Self> {
        let layer_size = height * width;
        if layer_size == 0 {
            bail!("mask dimensions must be non-zero");
        }
        if data.is_empty() || !data.len().is_multiple_of(layer_size) {
            bail!(
                "mask data length {} is not a multiple of {height}×{width} = {layer_size}",
                data.len(),
            );
        }
        Ok(Self {
            data,
            height,
            width,
        })
    }

    #[must_use]
    pub fn area(&self) -> usize {
        self.height * self.width
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mask_new_valid() {
        let data = Bytes::from(vec![0u8; 400]);
        let mask = Mask::new(data, 20, 20).unwrap();
        assert_eq!(mask.area(), 400);
    }

    #[test]
    fn mask_new_multi_layer() {
        let data = Bytes::from(vec![0u8; 600]); // 3 layers of 10×20
        let mask = Mask::new(data, 10, 20).unwrap();
        assert_eq!(mask.data.len(), 600);
    }

    #[test]
    fn mask_new_invalid_length() {
        let data = Bytes::from(vec![0u8; 101]);
        assert!(Mask::new(data, 20, 20).is_err());
    }
}
