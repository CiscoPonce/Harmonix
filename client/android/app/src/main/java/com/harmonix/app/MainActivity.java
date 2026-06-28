package com.harmonix.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setWebViewClient(new NgrokWebViewClient(bridge));
        }
    }

    /** Bypass ngrok free-tier browser interstitial for WebView loads. */
    static class NgrokWebViewClient extends BridgeWebViewClient {
        private boolean reloadedWithHeader = false;

        NgrokWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!reloadedWithHeader && url != null && url.contains("ngrok")) {
                reloadedWithHeader = true;
                Map<String, String> headers = new HashMap<>();
                headers.put("ngrok-skip-browser-warning", "true");
                view.loadUrl(url, headers);
                return;
            }
            super.onPageFinished(view, url);
        }
    }
}
