package com.gody.app;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private static final String TAG = "GODY";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        setContentView(R.layout.activity_main);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView = findViewById(R.id.webview);

        // JavaScript interface
        webView.addJavascriptInterface(new Object() {

            @JavascriptInterface
            public String listAssets(String subfolder) {
                try {
                    String path = (subfolder == null || subfolder.isEmpty())
                            ? ""
                            : subfolder;

                    String[] files = getAssets().list(path);

                    org.json.JSONArray arr =
                            new org.json.JSONArray();

                    if (files != null) {
                        for (String f : files) {
                            arr.put(f);
                        }
                    }

                    return arr.toString();

                } catch (Exception e) {
                    Log.e(TAG, "listAssets error", e);
                    return "[]";
                }
            }

        }, "Android");

        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        settings.setAllowFileAccess(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(
                    WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            );
        }

        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);

        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android "
                        + Build.VERSION.RELEASE
                        + ") AppleWebKit/537.36 "
                        + "(KHTML, like Gecko) "
                        + "Chrome/120.0.0.0 Mobile Safari/537.36"
        );

        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onConsoleMessage(ConsoleMessage msg) {

                Log.d(
                        TAG,
                        "[JS "
                                + msg.messageLevel()
                                + "] "
                                + msg.message()
                                + " (line "
                                + msg.lineNumber()
                                + ")"
                );

                return true;
            }

            @Override
            public void onPermissionRequest(
                    final PermissionRequest request
            ) {
                runOnUiThread(() -> {
                    if (Build.VERSION.SDK_INT >=
                            Build.VERSION_CODES.LOLLIPOP) {

                        request.grant(
                                request.getResources()
                        );
                    }
                });
            }
        });

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public void onReceivedError(
                    WebView view,
                    int errorCode,
                    String description,
                    String failingUrl
            ) {
                Log.e(
                        TAG,
                        "WebView error: "
                                + description
                                + " | URL: "
                                + failingUrl
                );
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    String url
            ) {
                view.loadUrl(url);
                return true;
            }
        });

        webView.setScrollBarStyle(
                WebView.SCROLLBARS_OUTSIDE_OVERLAY
        );

        webView.loadUrl(
                "file:///android_asset/index.html"
        );
    }

    @Override
    public void onBackPressed() {

        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();

        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {

        if (webView != null) {
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
