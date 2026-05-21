// The kDupe bookmarklet — runs on the user's current tab when they
// click the bookmark. Grabs document.title, strips common retailer
// suffixes / prefixes, opens a new tab to /search?q=<cleaned name>.
//
// One-line by design: some browsers strip newlines from javascript:
// URLs before executing them, so we keep this as a single statement
// chain.

const SOURCE = `(function(){var t=(document.title||'').replace(/\\s*[|\\-–—:]\\s*(Sephora|Ulta\\s*Beauty|Ulta|Kiehl['’]?s|Drunk\\s*Elephant|Nordstrom|Macy['’]?s|Bluemercury|Dermstore|Skinstore|Cult\\s*Beauty|Beautylish|Credo|Space\\s*NK|Mecca|Amazon[\\.,]?\\s*com|Amazon)\\b[\\s\\S]*$/i,'').replace(/^Amazon[\\.,]?\\s*com\\s*:?\\s*/i,'').replace(/\\s*:\\s*Beauty[\\s\\S]*$/i,'').trim();if(!t){alert('kDupe could not detect a product name from this page.');return;}window.open('https://seoulful.co/search?q='+encodeURIComponent(t),'_blank');})();`;

// Pretty-printed version shown in the install instructions code block.
// Functionally identical to SOURCE; only formatting differs.
export const BOOKMARKLET_READABLE = `(function () {
  var t = (document.title || "")
    .replace(
      /\\s*[|\\-–—:]\\s*(Sephora|Ulta\\s*Beauty|Ulta|Kiehl['’]?s|Drunk\\s*Elephant|Nordstrom|Macy['’]?s|Bluemercury|Dermstore|Skinstore|Cult\\s*Beauty|Beautylish|Credo|Space\\s*NK|Mecca|Amazon[\\.,]?\\s*com|Amazon)\\b[\\s\\S]*$/i,
      ""
    )
    .replace(/^Amazon[\\.,]?\\s*com\\s*:?\\s*/i, "")
    .replace(/\\s*:\\s*Beauty[\\s\\S]*$/i, "")
    .trim();
  if (!t) {
    alert("kDupe could not detect a product name from this page.");
    return;
  }
  window.open(
    "https://seoulful.co/search?q=" + encodeURIComponent(t),
    "_blank"
  );
})();`;

// The string that goes into <a href="...">. Browsers expect the
// javascript: prefix; some also require explicit %20 for spaces, but
// modern browsers handle raw single-line source.
export const BOOKMARKLET_HREF = `javascript:${SOURCE}`;
