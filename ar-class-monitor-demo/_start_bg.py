import subprocess, os, sys
D = r'C:\Users\Administrator\AppData\Roaming\WideWing\Backend\topics\3b40dbaccda4\outputs\ar-class-monitor-demo'
os.chdir(D)
py = r'C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe'
if not os.path.exists(py):
    py = sys.executable
log = open(os.path.join(D, 'server.log'), 'a', encoding='utf-8', errors='replace')
p = subprocess.Popen([py, 'server.py', '8099'], stdout=log, stderr=log,
                     creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0) | getattr(subprocess, 'DETACHED_PROCESS', 0))
print('started pid', p.pid)
