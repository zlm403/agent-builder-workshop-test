import subprocess, time, socket, sys, os
os.chdir(r'C:\Users\Administrator\AppData\Roaming\WideWing\Backend\topics\3b40dbaccda4\outputs\ar-class-monitor-demo')
py = r'C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe'
if not os.path.exists(py):
    import sys as _s
    py = _s.executable
    print('fallback py:', py)
p = subprocess.Popen([py, 'server.py', '8099'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
time.sleep(3)
print('poll:', p.poll())
if p.poll() is not None:
    out, err = p.communicate(timeout=5)
    print('STDOUT:', out)
    print('STDERR:', err)
else:
    print('still running, pid', p.pid)
    s = socket.socket()
    try:
        s.settimeout(2)
        s.connect(('127.0.0.1', 8099))
        print('port 8099 OPEN')
    except Exception as e:
        print('port 8099 closed:', e)
    finally:
        s.close()
    p.terminate()
