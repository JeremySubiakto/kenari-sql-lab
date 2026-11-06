// Runs the site in WebKit, the engine behind Safari, with no browser window to manage.
//
//   swiftc -O scripts/dev/webkit-check.swift -o /tmp/webkit-check
//   /tmp/webkit-check <url> <width> <height> <out.png> [wait-for-js-expression] [timeout-seconds] [user-agent]
//
// Loads the URL, reports script errors, optionally polls a JS expression until it is truthy,
// prints the expression's value as JSON, and saves a screenshot.
import Cocoa
import WebKit

let args = CommandLine.arguments
guard args.count >= 5 else { print("usage: url width height out.png [expr] [timeout] [ua]"); exit(2) }
let url = URL(string: args[1])!
let width = Double(args[2])!, height = Double(args[3])!
let outPath = args[4]
let expr = args.count > 5 ? args[5] : ""
let timeout = args.count > 6 ? Double(args[6])! : 20
let userAgent = args.count > 7 ? args[7] : nil

final class Delegate: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
  var errors: [String] = []
  func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) { errors.append("\(m.body)") }
  func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { errors.append("nav: \(e)") }
  func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { errors.append("load: \(e)") }
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

let cfg = WKWebViewConfiguration()
let del = Delegate()
cfg.userContentController.add(del, name: "report")
cfg.userContentController.addUserScript(WKUserScript(source: """
  addEventListener('error', function (e) { webkit.messageHandlers.report.postMessage('error: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
  addEventListener('unhandledrejection', function (e) { webkit.messageHandlers.report.postMessage('rejection: ' + (e.reason && (e.reason.message || e.reason.type) || e.reason)); });
  (function () { var o = console.error; console.error = function () { webkit.messageHandlers.report.postMessage('console: ' + [].slice.call(arguments).join(' ')); o.apply(console, arguments); }; })();
""", injectionTime: .atDocumentStart, forMainFrameOnly: true))

let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: width, height: height), styleMask: [.borderless], backing: .buffered, defer: false)
let web = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: height), configuration: cfg)
if let ua = userAgent { web.customUserAgent = ua }
web.navigationDelegate = del
window.contentView = web
window.orderBack(nil)
web.load(URLRequest(url: url))

let start = Date()
func finish(_ value: String) {
  let snap = WKSnapshotConfiguration()
  web.takeSnapshot(with: snap) { image, _ in
    if let image = image, let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) {
      try? png.write(to: URL(fileURLWithPath: outPath))
    }
    print("value: \(value)")
    print("errors: \(del.errors.count)")
    del.errors.prefix(12).forEach { print("  \($0)") }
    print(String(format: "seconds: %.1f", Date().timeIntervalSince(start)))
    exit(del.errors.isEmpty ? 0 : 1)
  }
}

func poll() {
  if Date().timeIntervalSince(start) > timeout { finish("TIMEOUT") ; return }
  if expr.isEmpty {
    if Date().timeIntervalSince(start) > 4 { finish("loaded") } else { DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: poll) }
    return
  }
  web.callAsyncJavaScript("const v = await (async () => { return (\(expr)); })(); return v == null ? null : JSON.stringify(v);", arguments: [:], in: nil, in: .page) { result in
    if case .success(let any) = result, let s = any as? String, s != "false", s != "null" { finish(s) ; return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: poll)
  }
}
DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: poll)
app.run()
