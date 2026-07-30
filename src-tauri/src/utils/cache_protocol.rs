use crate::config::dirs;
use http::header::{ACCESS_CONTROL_ALLOW_ORIGIN, CONTENT_TYPE};
use http::{HeaderValue, Request, Response, StatusCode};
use logging::{logging, Type};

pub fn cache_protocol_handler(
    _ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let hash = request.uri().path().trim_start_matches('/').to_string();
    let cache_dir = match dirs::app_cache_dir() {
        Ok(dir) => dir,
        Err(_) => {
            let mut response = Response::new(b"cache dir unavailable".to_vec());
            *response.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
            return response;
        }
    };

    let path = cache_dir.join(&hash);

    match std::fs::read(&path) {
        Ok(bytes) => {
            let mime = mime_guess::from_path(&path)
                .first_or_octet_stream()
                .to_string();
            let mut response = Response::new(bytes);
            let headers = response.headers_mut();
            headers.insert(
                CONTENT_TYPE,
                HeaderValue::from_str(&mime)
                    .unwrap_or(HeaderValue::from_static("application/octet-stream")),
            );
            headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
            response
        }
        Err(_) => {
            logging!(warn, Type::System, "cache:// content not found: {hash}");
            let mut response = Response::new(b"content not found".to_vec());
            *response.status_mut() = StatusCode::NOT_FOUND;
            response
                .headers_mut()
                .insert(CONTENT_TYPE, HeaderValue::from_static("text/plain"));
            response
        }
    }
}
