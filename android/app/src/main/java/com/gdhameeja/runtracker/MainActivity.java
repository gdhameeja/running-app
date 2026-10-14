package com.gdhameeja.runtracker;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.gdhameeja.runtracker.tracking.RunTrackerPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RunTrackerPlugin.class);
        super.onCreate(savedInstanceState);

        // Back walks the page's history first: the run screen and run details
        // push an entry, so back minimises the run (it keeps going) or closes
        // the details instead of leaving the app.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
