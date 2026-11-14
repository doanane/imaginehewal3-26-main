"""The two web pages the emailed links open: confirm an email address, choose a new password.

They work on any phone or computer, with or without the app. The server's security policy blocks inline scripts and styles, so the page loads its
own small CSS and JS files from /auth/pages/ and sets a policy that allows exactly that, plus the logo from our Cloudinary.
The verification page confirms with a POST made by its script, not by merely loading the page, so a mail program that pre-opens links to scan them
cannot use the token up.
"""
import html
import json
import os
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, Response

router = APIRouter(prefix="/auth", tags=["authentication pages"])

CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://res.cloudinary.com data:; connect-src 'self'; "
       "form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
HEADERS = {"Content-Security-Policy": CSP, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}

CSS = """
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#F4F7FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1B2733}
.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{width:100%;max-width:440px;background:#fff;border:1px solid #E3E9EF;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(15,40,60,.08)}
.bar{height:6px;background:#0B6E6E}.in{padding:26px 26px 30px;text-align:center}
.logo{width:110px;height:110px;display:block;margin:0 auto 4px}h1{font-size:22px;margin:10px 0 8px}p{line-height:1.55;color:#33424F;margin:8px 0}
.muted{color:#5B6B7A;font-size:14px}label{display:block;text-align:left;font-weight:600;font-size:14px;margin:16px 0 6px}
input{width:100%;font-size:16px;padding:13px 14px;border:1px solid #CBD5DF;border-radius:12px}input:focus{outline:2px solid #0B6E6E;border-color:#0B6E6E}
button,.btn{display:inline-block;width:100%;margin-top:20px;background:#0B6E6E;color:#fff;border:0;border-radius:12px;font-size:16px;font-weight:600;padding:14px;text-decoration:none;cursor:pointer}
button[disabled]{opacity:.6;cursor:wait}.ok{color:#17724A}.bad{color:#B42318}.note{min-height:22px;font-size:14px;margin-top:12px}
.spin{width:34px;height:34px;border:4px solid #CFE6E3;border-top-color:#0B6E6E;border-radius:50%;margin:20px auto;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}
"""

VERIFY_JS = """
(function(){
  var el=document.getElementById('v'),token=el.getAttribute('data-token');
  var title=document.getElementById('t'),msg=document.getElementById('m'),spin=document.getElementById('s'),open=document.getElementById('o');
  fetch('/auth/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token})})
   .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
   .then(function(x){spin.hidden=true;
     if(x.ok){title.textContent='Email verified';title.className='ok';msg.textContent='Thank you. Your email address is confirmed. You can go back to the HEWAL3 app.';open.hidden=false;}
     else{title.textContent='This link did not work';title.className='bad';msg.textContent='It may have expired or already been used. Open the HEWAL3 app and ask for a new code.';}})
   .catch(function(){spin.hidden=true;title.textContent='Could not reach the server';title.className='bad';msg.textContent='Please check your connection and open the link again.';});
})();
"""

RESET_JS = """
(function(){
  var f=document.getElementById('f'),token=f.getAttribute('data-token'),note=document.getElementById('n'),go=document.getElementById('g');
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var a=document.getElementById('p1').value,b=document.getElementById('p2').value;
    note.className='note bad';
    if(a.length<8){note.textContent='Use at least 8 characters.';return;}
    if(a!==b){note.textContent='The two passwords are not the same.';return;}
    go.disabled=true;note.className='note';note.textContent='Saving...';
    fetch('/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token,new_password:a})})
     .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
     .then(function(x){
       if(x.ok){f.hidden=true;document.getElementById('t').textContent='Password changed';document.getElementById('t').className='ok';
         document.getElementById('m').textContent='Your password was changed and you were signed out of your other devices. Go back to the HEWAL3 app and sign in.';document.getElementById('o').hidden=false;note.textContent='';}
       else{go.disabled=false;note.className='note bad';note.textContent=(typeof x.j.detail==='string'?x.j.detail:'That did not work.')+' Ask for a new link from the app if this one expired.';}})
     .catch(function(){go.disabled=false;note.className='note bad';note.textContent='Could not reach the server. Try again.';});
  });
})();
"""


def _logo() -> str:
    try:
        with open(os.path.join(os.path.dirname(__file__), "..", "data", "brand.json"), encoding="utf-8") as f:
            url = json.load(f).get("logo_url")
    except Exception:
        url = None
    return f'<img class="logo" src="{html.escape(url, quote=True)}" alt="HEWAL3">' if url else '<h2>HEWAL3</h2>'


def _page(body: str, script: str) -> HTMLResponse:
    doc = (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
           f'<title>HEWAL3</title><link rel="stylesheet" href="/auth/pages/pages.css"></head><body><div class="wrap"><div class="card"><div class="bar"></div>'
           f'<div class="in">{_logo()}{body}</div></div></div><script src="/auth/pages/{script}"></script></body></html>')
    return HTMLResponse(doc, headers=HEADERS)


@router.get("/pages/pages.css", include_in_schema=False)
def pages_css():
    return Response(CSS, media_type="text/css", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/pages/verify.js", include_in_schema=False)
def verify_js():
    return Response(VERIFY_JS, media_type="application/javascript", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/pages/reset.js", include_in_schema=False)
def reset_js():
    return Response(RESET_JS, media_type="application/javascript", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/verify-email-page/{token}", response_class=HTMLResponse, include_in_schema=False)
def verify_email_page(token: str):
    body = ('<div id="v" data-token="' + html.escape(token, quote=True) + '"></div><div id="s" class="spin"></div><h1 id="t">Confirming your email</h1>'
            '<p id="m" class="muted">One moment...</p><a id="o" class="btn" href="hewal3://" style="display:none">Open the HEWAL3 app</a>')
    return _page(body.replace(' style="display:none"', ' hidden'), "verify.js")


@router.get("/reset-password-page", response_class=HTMLResponse, include_in_schema=False)
def reset_password_page(token: Optional[str] = Query(None)):
    if not token:
        return _page('<h1 class="bad">This link is not complete</h1><p class="muted">Open the HEWAL3 app, choose Forgot password and we will email you a new one.</p>', "reset.js")
    body = ('<h1 id="t">Choose a new password</h1><p id="m" class="muted">Use at least 8 characters. You will be signed out of your other devices.</p>'
            '<form id="f" data-token="' + html.escape(token, quote=True) + '" autocomplete="off"><label for="p1">New password</label>'
            '<input id="p1" type="password" autocomplete="new-password" required><label for="p2">Repeat the new password</label>'
            '<input id="p2" type="password" autocomplete="new-password" required><button id="g" type="submit">Save password</button></form>'
            '<div id="n" class="note"></div><a id="o" class="btn" href="hewal3://" hidden>Open the HEWAL3 app</a>')
    return _page(body, "reset.js")
