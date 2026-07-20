use anyhow::bail;
use ndarray::Array3;

/// A grayscale mask (u8 per pixel) with spatial dimensions.
/// Backed by an `Array3<u8>` of shape `(layers, height, width)`.
#[derive(Debug, Clone)]
pub struct Mask {
    inner: Array3<u8>,
}

impl Mask {
    /// Create a new mask from raw pixel data.
    ///
    /// `data.len()` must be a positive multiple of `height * width`.
    ///
    /// # Errors
    ///
    /// Returns an error if dimensions are zero or data length is inconsistent.
    pub fn new(data: Vec<u8>, height: usize, width: usize) -> anyhow::Result<Self> {
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
        let layers = data.len() / layer_size;
        let inner = Array3::from_shape_vec((layers, height, width), data)
            .map_err(|e| anyhow::anyhow!("failed to create mask array: {e}"))?;
        Ok(Self { inner })
    }

    #[must_use]
    pub fn height(&self) -> usize {
        self.inner.shape()[1]
    }

    #[must_use]
    pub fn width(&self) -> usize {
        self.inner.shape()[2]
    }

    #[must_use]
    pub fn layers(&self) -> usize {
        self.inner.shape()[0]
    }

    #[must_use]
    pub fn area(&self) -> usize {
        self.height() * self.width()
    }

    #[must_use]
    pub fn inner(&self) -> &Array3<u8> {
        &self.inner
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mask_new_valid() {
        let data = vec![0u8; 400];
        let mask = Mask::new(data, 20, 20).unwrap();
        assert_eq!(mask.area(), 400);
        assert_eq!(mask.layers(), 1);
    }

    #[test]
    fn mask_new_multi_layer() {
        let data = vec![0u8; 600]; // 3 layers of 10×20
        let mask = Mask::new(data, 10, 20).unwrap();
        assert_eq!(mask.layers(), 3);
        assert_eq!(mask.height(), 10);
        assert_eq!(mask.width(), 20);
    }

    #[test]
    fn mask_new_invalid_length() {
        let data = vec![0u8; 101];
        assert!(Mask::new(data, 20, 20).is_err());
    }

    #[test]
    fn mask_new_zero_dims() {
        assert!(Mask::new(vec![0u8; 10], 0, 10).is_err());
        assert!(Mask::new(vec![0u8; 10], 10, 0).is_err());
    }
}
