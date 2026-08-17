// =============================================================================
// ZoomableSvgModal — pełnoekranowy podgląd SVG z pinch-zoom / pan / double-tap.
//
// Renderujemy przez WebView (tak jak inline SvgViewer), żeby SVG wyglądało
// identycznie jak w karcie — materiały egzaminacyjne używają <text>,
// font-family, <marker>, <pattern>, z którymi react-native-svg bywa niepewny.
// Gesty są obsługiwane w JS wewnątrz WebView (touch events + CSS transform),
// więc nie zależą od ustawień zoomu Androidowego WebView ani od walki o gesty
// z zewnętrznym ScrollView (modal jest poza nim).
// =============================================================================

import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  svg: string;
  onClose: () => void;
  isDark: boolean;
  title?: string;
}

const MAX_SCALE = 6;

// Skrypt gestów trzymamy jako osobny string bez interpolacji, żeby żaden
// backslash w regexach nie był podwójnie escapowany przez template literal.
const GESTURE_SCRIPT = String.raw`
(function(){
  var MAX=__MAX__, MIN=1;
  var w=document.getElementById('w'), c=document.getElementById('c');
  var svg=c.querySelector('svg');
  var vw=window.innerWidth, vh=window.innerHeight;
  // Naturalny rozmiar SVG: viewBox → width/height → fallback.
  var W=800,H=400;
  if(svg){
    var vb=svg.getAttribute('viewBox');
    if(vb){var p=vb.trim().split(/[\s,]+/).map(Number); if(p.length>=4&&p[2]>0&&p[3]>0){W=p[2];H=p[3];}}
    else{var aw=parseFloat(svg.getAttribute('width')),ah=parseFloat(svg.getAttribute('height')); if(aw>0&&ah>0){W=aw;H=ah;}}
    if(!vb) svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  }
  var pad=12, s0, cw, ch;
  function fit(){
    s0=Math.min((vw-2*pad)/W,(vh-2*pad)/H); cw=W*s0; ch=H*s0;
    if(svg){svg.setAttribute('width',cw);svg.setAttribute('height',ch);svg.style.width=cw+'px';svg.style.height=ch+'px';}
    c.style.width=cw+'px'; c.style.height=ch+'px';
  }
  fit();
  var k=1, tx=(vw-cw)/2, ty=(vh-ch)/2;
  function clamp(){
    var sw=cw*k, sh=ch*k;
    if(sw<=vw) tx=(vw-sw)/2; else tx=Math.min(0,Math.max(vw-sw,tx));
    if(sh<=vh) ty=(vh-sh)/2; else ty=Math.min(0,Math.max(vh-sh,ty));
  }
  function apply(){clamp(); c.style.transform='translate('+tx+'px,'+ty+'px) scale('+k+')';}
  apply();
  function zoomAt(px,py,nk){
    nk=Math.max(MIN,Math.min(MAX,nk));
    var r=nk/k;
    tx=px-(px-tx)*r; ty=py-(py-ty)*r; k=nk; apply();
  }
  var mode=null, lastX=0,lastY=0, d0=0,k0=1, mx0=0,my0=0, tx0=0,ty0=0;
  var lastTap=0, lastTapX=0,lastTapY=0, moved=false;
  function dist(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
  function mid(a,b){return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};}
  w.addEventListener('touchstart',function(e){
    e.preventDefault();
    var t=e.touches;
    if(t.length===1){mode='pan';lastX=t[0].clientX;lastY=t[0].clientY;moved=false;}
    else if(t.length>=2){mode='pinch';d0=dist(t[0],t[1])||1;k0=k;var m=mid(t[0],t[1]);mx0=m.x;my0=m.y;tx0=tx;ty0=ty;moved=true;}
  },{passive:false});
  w.addEventListener('touchmove',function(e){
    e.preventDefault();
    var t=e.touches;
    if(mode==='pinch'&&t.length>=2){
      var d=dist(t[0],t[1]); var m=mid(t[0],t[1]);
      var nk=Math.max(MIN,Math.min(MAX,k0*d/d0));
      var r=nk/k0;
      tx=m.x-(mx0-tx0)*r; ty=m.y-(my0-ty0)*r; k=nk; apply();
    } else if(mode==='pan'&&t.length===1){
      var dx=t[0].clientX-lastX, dy=t[0].clientY-lastY;
      if(Math.abs(dx)>3||Math.abs(dy)>3) moved=true;
      lastX=t[0].clientX; lastY=t[0].clientY;
      tx+=dx; ty+=dy; apply();
    }
  },{passive:false});
  w.addEventListener('touchend',function(e){
    e.preventDefault();
    if(e.touches.length===0){
      if(mode==='pan'&&!moved){
        var now=Date.now(); var ct=e.changedTouches[0];
        if(now-lastTap<300&&Math.hypot(ct.clientX-lastTapX,ct.clientY-lastTapY)<40){
          zoomAt(ct.clientX,ct.clientY,k>1.05?1:2.5); lastTap=0;
        } else {lastTap=now;lastTapX=ct.clientX;lastTapY=ct.clientY;}
      }
      mode=null;
    } else if(e.touches.length===1){
      mode='pan';lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;moved=true;
    }
  },{passive:false});
  w.addEventListener('touchcancel',function(){mode=null;},{passive:false});
  window.addEventListener('resize',function(){
    vw=window.innerWidth; vh=window.innerHeight; fit(); k=1; apply();
  });
})();
`.replace("__MAX__", String(MAX_SCALE));

function buildHtml(svg: string, bg: string): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    "<style>*{margin:0;padding:0;box-sizing:border-box}" +
    `html,body{width:100%;height:100%;background:${bg};overflow:hidden;overscroll-behavior:none}` +
    "#w{position:fixed;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}" +
    "#c{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}" +
    "#c svg{display:block}</style></head><body>" +
    `<div id="w"><div id="c">${svg}</div></div>` +
    `<script>${GESTURE_SCRIPT}</script></body></html>`
  );
}

export function ZoomableSvgModal({
  visible,
  svg,
  onClose,
  isDark,
  title,
}: Props) {
  const insets = useSafeAreaInsets();
  const bg = isDark ? "#0f0f23" : "#ffffff";
  const html = useMemo(() => buildHtml(svg, bg), [svg, bg]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={bg}
      />
      <View style={{ flex: 1, backgroundColor: bg }}>
        {visible && (
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1, backgroundColor: bg }}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            setBuiltInZoomControls={false}
            javaScriptEnabled
            androidLayerType={
              Platform.OS === "android" ? "hardware" : undefined
            }
          />
        )}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top + 8,
            paddingHorizontal: 12,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.06)",
              maxWidth: "75%",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: isDark ? "#c7c7d9" : "#4b5563",
              }}
            >
              {title || "Szczypnij, aby powiększyć · stuknij 2× — zbliżenie"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.08)",
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: isDark ? "#ffffff" : "#111827",
                lineHeight: 20,
              }}
            >
              ✕
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
