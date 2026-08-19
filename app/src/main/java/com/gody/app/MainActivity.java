package com.gody.app;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
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

        // Полноэкранный режим
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        setContentView(R.layout.activity_main);

        // WebView debugging
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView = findViewById(R.id.webview);

        WebSettings settings = webView.getSettings();

        // JavaScript
        settings.setJavaScriptEnabled(true);

        // localStorage
        settings.setDomStorageEnabled(true);

        // Доступ к файлам
        settings.setAllowFileAccess(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        }

        // Разрешить смешанный контент
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(
                    WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            );
        }

        // Масштабирование
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);

        // Всегда загружать свежую версию
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        // User-Agent
        settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android "
                        + Build.VERSION.RELEASE
                        + ") AppleWebKit/537.36 "
                        + "(KHTML, like Gecko) "
                        + "Chrome/120.0.0.0 Mobile Safari/537.36"
        );

        // ==============================
        // WebChromeClient
        // ==============================

        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onConsoleMessage(ConsoleMessage msg) {

                String level = msg.messageLevel().toString();

                Log.d(
                        TAG,
                        "[JS " + level + "] "
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

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {

                        // Разрешаем ресурсы, которые запросил WebView.
                        request.grant(request.getResources());
                    }
                });
            }
        });

        // ==============================
        // WebViewClient
        // ==============================

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

        // Полоса прокрутки
        webView.setScrollBarStyle(
                WebView.SCROLLBARS_OUTSIDE_OVERLAY
        );

        // Запуск GODY
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
