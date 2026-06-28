package com.harmonix.app;

import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "Harmonix";
    private static final String SERVER_URL = "https://moral-sparrow-nationally.ngrok-free.app";
    private boolean remoteLoaded = false;

    @Override
    public void onStart() {
        super.onStart();
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        WebView webView = bridge.getWebView();
        webView.getSettings().setDomStorageEnabled(true);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new NgrokWebViewClient(bridge));

        if (!remoteLoaded) {
            remoteLoaded = true;
            Map<String, String> headers = new HashMap<>();
            headers.put("ngrok-skip-browser-warning", "true");
            Log.i(TAG, "Loading remote Harmonix URL");
            webView.loadUrl(SERVER_URL, headers);
        }
    }

    /**
     * Adds ngrok bypass header for static GET loads only.
     * API calls (POST /api/*) must use the WebView network stack so bodies and cookies work.
     */
    static class NgrokWebViewClient extends BridgeWebViewClient {

        NgrokWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            String method = request.getMethod();

            if (!"GET".equalsIgnoreCase(method) || url.contains("/api/")) {
                return super.shouldInterceptRequest(view, request);
            }

            if (url.contains("ngrok-free.app") || url.contains("ngrok-free.dev")) {
                WebResourceResponse response = fetchWithNgrokHeader(url);
                if (response != null) {
                    return response;
                }
            }
            return super.shouldInterceptRequest(view, request);
        }

        private WebResourceResponse fetchWithNgrokHeader(String urlString) {
            try {
                URL url = new URL(urlString);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setRequestProperty("ngrok-skip-browser-warning", "true");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.connect();

                int code = connection.getResponseCode();
                InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (stream == null) {
                    return null;
                }

                String contentType = connection.getContentType();
                String mime = "text/html";
                String encoding = "utf-8";
                if (contentType != null) {
                    String[] parts = contentType.split(";");
                    mime = parts[0].trim();
                    for (String part : parts) {
                        if (part.trim().toLowerCase().startsWith("charset=")) {
                            encoding = part.trim().substring("charset=".length());
                        }
                    }
                }

                return new WebResourceResponse(mime, encoding, stream);
            } catch (Exception e) {
                Log.w(TAG, "Ngrok intercept failed for " + urlString + ": " + e.getMessage());
                return null;
            }
        }
    }
}
