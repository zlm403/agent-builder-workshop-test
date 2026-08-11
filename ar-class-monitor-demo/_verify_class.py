import urllib.request, json
url = 'http://127.0.0.1:8099/api/class'
data = json.load(urllib.request.urlopen(url, timeout=5))
print('totalTurns:', data['totalTurns'])
print('taskTurn:', data['taskTurn'])
print('students:', len(data['students']))
for task in data['byTask']:
    bt = data['byTask'][task]
    print(f"byTask[{task}] students={len(bt)}")
    for sid, v in list(bt.items())[:2]:
        evs = v['events']
        kinds = {}
        for e in evs:
            kinds[e['event']] = kinds.get(e['event'], 0) + 1
        print(f"   {sid}: events={len(evs)} ts={v['ts']} kinds={kinds}")
