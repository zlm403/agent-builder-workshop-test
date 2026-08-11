import urllib.request, sys
try:
    r = urllib.request.urlopen('http://localhost:8099/', timeout=5)
    print('HTTP', r.status)
    body = r.read(300).decode('utf-8', 'replace')
    print(body[:300])
except Exception as e:
    print('FAIL', e)
