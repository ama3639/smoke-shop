"""Local launcher regression tests; no project DB, npm server or fixed ports."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import unittest
from unittest.mock import Mock, patch
from contextlib import contextmanager
import dev


@contextmanager
def health_server(responses):
    class Handler(BaseHTTPRequestHandler):
        attempts = 0

        def do_GET(self):
            index = min(type(self).attempts, len(responses) - 1)
            type(self).attempts += 1
            status, body = responses[index]
            self.send_response(status)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    with ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}/api/v1/health/', Handler
        finally:
            server.shutdown()
            thread.join()


class LauncherTests(unittest.TestCase):
    def test_waits_through_failure_until_database_health_is_ready(self):
        process = Mock()
        process.poll.return_value = None
        with health_server([(503, b'not ready'), (200, b'{"success":true,"data":{"status":"ok"}}')]) as (url, handler):
            dev.wait_for_backend(process, timeout=3, url=url)
            self.assertGreaterEqual(handler.attempts, 2)

    def test_wrong_health_response_times_out(self):
        process = Mock()
        process.poll.return_value = None
        for body in [b'not JSON', b'{"success":false}', b'{"success":true,"data":{"status":"error"}}']:
            with self.subTest(body=body), health_server([(200, body)]) as (url, _):
                with self.assertRaisesRegex(SystemExit, 'not ready within'):
                    dev.wait_for_backend(process, timeout=.05, url=url)

    def test_exited_backend_fails_without_http_probe(self):
        process = Mock(returncode=7)
        process.poll.return_value = 7
        with patch.object(dev, 'build_opener') as opener:
            with self.assertRaisesRegex(SystemExit, 'code 7'):
                dev.wait_for_backend(process)
            opener.return_value.open.assert_not_called()

    def test_busy_port_is_reported_before_processes_start(self):
        with patch.object(dev.socket, 'socket') as sock:
            sock.return_value.__enter__.return_value.bind.side_effect = OSError('busy')
            with self.assertRaisesRegex(SystemExit, 'Port 8000 is unavailable'):
                dev.check_ports()

    def run_main(self, wait_effect):
        backend, frontend = Mock(pid=123), Mock(pid=456)
        backend.poll.return_value = frontend.poll.return_value = 0
        with patch.object(dev.Path, 'exists', return_value=True), patch.object(dev.shutil, 'which', return_value='npm'), patch.object(dev, 'check_ports'), patch.object(dev.subprocess, 'Popen', side_effect=[backend, frontend]) as spawn, patch.object(dev, 'wait_for_backend') as wait:
            wait.side_effect = lambda process: wait_effect(process, spawn, backend)
            with self.assertRaises(SystemExit):
                dev.main()
            return spawn.call_count

    def test_frontend_spawns_only_after_health_gate(self):
        def gate(process, spawn, backend):
            self.assertIs(process, backend)
            self.assertEqual(spawn.call_count, 1)
        self.assertEqual(self.run_main(gate), 2)

    def test_failed_readiness_does_not_start_frontend(self):
        def fail(process, spawn, backend):
            raise SystemExit('backend failed')
        self.assertEqual(self.run_main(fail), 1)


if __name__ == '__main__':
    unittest.main()
