"""Preparar o volume e executar o serviço sem privilégios de root."""
import os
import pwd
import sys
from pathlib import Path
if os.geteuid()==0:
    account=pwd.getpwnam('monitor')
    Path('/data').mkdir(parents=True,exist_ok=True)
    os.chown('/data',account.pw_uid,account.pw_gid)
    os.setgroups([])
    os.setgid(account.pw_gid)
    os.setuid(account.pw_uid)
os.execv(sys.executable,[sys.executable,'server.py'])
