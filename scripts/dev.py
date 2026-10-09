"""Start both local services and stop only the child processes started here."""
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    python = ROOT / 'backend/.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not python.exists() or not (ROOT / 'frontend/node_modules').exists() or not npm:
        raise SystemExit('Run python scripts/setup.py first.')
    processes = []
    process_options = {'start_new_session': True} if os.name != 'nt' else {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP}
    try:
        processes.append(subprocess.Popen([str(python), 'manage.py', 'runserver', '127.0.0.1:8000', '--noreload'], cwd=ROOT / 'backend', **process_options))
        processes.append(subprocess.Popen([npm, 'run', 'dev'], cwd=ROOT / 'frontend', **process_options))
        print('Store: http://localhost:3000 | Admin: http://localhost:8000/admin/ | Ctrl+C stops both services.', flush=True)
        while all(p.poll() is None for p in processes):
            time.sleep(.5)
        raise SystemExit('One service stopped. Check the error above; both services will now stop.')
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    os.killpg(process.pid, signal.SIGTERM)
        for process in processes:
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == '__main__':
    main()
