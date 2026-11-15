package nova3.mani

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import java.io.File

/**
 * MANI Android shell: WebView against the Azure deployment only.
 * HTTP + DOM storage cache is kept aggressively (no eviction by the app).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var offlineBanner: TextView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progress = findViewById(R.id.progress)
        offlineBanner = findViewById(R.id.offlineBanner)

        ensureHugeCacheDirs()
        configureWebView(webView)
        observeConnectivity()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) webView.goBack() else finish()
                }
            },
        )

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(BuildConfig.MANI_URL)
        }
    }

    private fun ensureHugeCacheDirs() {
        // Dedicated large cache roots; the app never clears them.
        val httpCache = File(cacheDir, "mani_http_cache").apply { mkdirs() }
        val webCache = File(cacheDir, "mani_webview").apply { mkdirs() }
        val dataCache = File(filesDir, "mani_persistent").apply { mkdirs() }
        // Hint to WebView: use our cache dir (platform still manages internals).
        webView.setTag(R.id.mani_cache_tag, listOf(httpCache.absolutePath, webCache.absolutePath, dataCache.absolutePath))
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(view: WebView) {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)

        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = false
            // Prefer network when online; fall back to disk cache when offline.
            cacheMode = if (isOnline()) {
                WebSettings.LOAD_DEFAULT
            } else {
                WebSettings.LOAD_CACHE_ELSE_NETWORK
            }
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            @Suppress("DEPRECATION")
            WebSettingsCompat.setForceDark(view.settings, WebSettingsCompat.FORCE_DARK_OFF)
        }

        view.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        view.webChromeClient =
            object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                    progress.progress = newProgress
                }
            }
        view.webViewClient =
            object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    // Keep navigation in-app; NASA tile CDNs load as subresources.
                    return false
                }

                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    progress.visibility = View.VISIBLE
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    progress.visibility = View.GONE
                    CookieManager.getInstance().flush()
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?,
                ) {
                    if (request?.isForMainFrame == true && !isOnline()) {
                        view?.settings?.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                        view?.loadUrl(BuildConfig.MANI_URL)
                    }
                }
            }
    }

    private fun observeConnectivity() {
        updateOfflineBanner()
        // Re-check when activity resumes; keeps banner honest without a sticky callback.
    }

    override fun onResume() {
        super.onResume()
        updateOfflineBanner()
        webView.settings.cacheMode =
            if (isOnline()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK
    }

    private fun updateOfflineBanner() {
        offlineBanner.visibility = if (isOnline()) View.GONE else View.VISIBLE
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        // Intentionally do NOT clear WebView / HTTP cache — unlimited retention for demo.
        CookieManager.getInstance().flush()
        webView.destroy()
        super.onDestroy()
    }
}
