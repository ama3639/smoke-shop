"""Start both local services and stop only the child processes started here."""
import os
import json
import socket
from urllib.error import URLError
from urllib.request import build_opener, ProxyHandler
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def check_ports():
    for port in (8000, 3000):
        try:
            with socket.socket() as probe:
                probe.bind(('127.0.0.1', port))
        except OSError:
            raise SystemExit(f'Port {port} is unavailable. Stop the existing local service before starting dev.py.')


def wait_for_backend(process, timeout=60, url='http://127.0.0.1:8000/api/v1/health/'):
    deadline = time.monotonic() + timeout
    # This is a loopback check; never send it through a configured network proxy.
    opener = build_opener(ProxyHandler({}))
    while True:
        if process.poll() is not None:
            raise SystemExit(f'Backend exited before becoming ready (code {process.returncode}). Check its log above; frontend was not started.')
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise SystemExit(f'Backend was not ready within {timeout} seconds. Check its log and database configuration; frontend was not started.')
        try:
            with opener.open(url, timeout=min(1, remaining)) as response:
                data = json.load(response)
                if response.status == 200 and data == {'success': True, 'data': {'status': 'ok'}} and process.poll() is None:
                    return
        except (URLError, OSError, ValueError):
            pass
        time.sleep(min(.2, max(0, deadline - time.monotonic())))


def main():
    python = ROOT / 'backend/.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not python.exists() or not (ROOT / 'frontend/node_modules').exists() or not npm:
        raise SystemExit('Run python scripts/setup.py first.')
    check_ports()
    processes = []
    process_options = {'start_new_session': True} if os.name != 'nt' else {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP}
    try:
        processes.append(subprocess.Popen([str(python), 'manage.py', 'runserver', '127.0.0.1:8000', '--noreload'], cwd=ROOT / 'backend', **process_options))
        print('Waiting for backend health (up to 60 seconds)...', flush=True)
        wait_for_backend(processes[0])
        print('Backend ready. Starting frontend; wait for Next.js Ready before opening the store.', flush=True)
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

