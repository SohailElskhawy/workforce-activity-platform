import base64
import os
import sys

if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes

    class _DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_char)),
        ]

    def protect_secret(secret: str) -> str:
        """Encrypt a string using Windows DPAPI (CryptProtectData)."""
        data = secret.encode("utf-8")
        in_blob = _DATA_BLOB(
            len(data),
            ctypes.cast(ctypes.create_string_buffer(data), ctypes.POINTER(ctypes.c_char)),
        )
        out_blob = _DATA_BLOB()
        # 0x01 = CRYPTPROTECT_UI_FORBIDDEN (ensure no UI dialog pops up)
        if not ctypes.windll.crypt32.CryptProtectData(
            ctypes.byref(in_blob),
            "WorkLensAgentToken",
            None,
            None,
            None,
            0x01,
            ctypes.byref(out_blob),
        ):
            raise ctypes.WinError()
        try:
            raw = ctypes.string_at(out_blob.pbData, out_blob.cbData)
            return base64.b64encode(raw).decode("ascii")
        finally:
            ctypes.windll.kernel32.LocalFree(out_blob.pbData)

    def unprotect_secret(encrypted_b64: str) -> str:
        """Decrypt a string using Windows DPAPI (CryptUnprotectData)."""
        try:
            raw = base64.b64decode(encrypted_b64.encode("ascii"))
        except Exception as err:
            raise ValueError("Invalid encrypted token encoding.") from err
        in_blob = _DATA_BLOB(
            len(raw),
            ctypes.cast(ctypes.create_string_buffer(raw), ctypes.POINTER(ctypes.c_char)),
        )
        out_blob = _DATA_BLOB()
        if not ctypes.windll.crypt32.CryptUnprotectData(
            ctypes.byref(in_blob),
            None,
            None,
            None,
            None,
            0x01,
            ctypes.byref(out_blob),
        ):
            raise ctypes.WinError()
        try:
            dec = ctypes.string_at(out_blob.pbData, out_blob.cbData)
            return dec.decode("utf-8")
        finally:
            ctypes.windll.kernel32.LocalFree(out_blob.pbData)

else:
    # Non-Windows fallback for test environments
    def protect_secret(secret: str) -> str:
        payload = f"non_win_mock:{secret}".encode("utf-8")
        return base64.b64encode(payload).decode("ascii")

    def unprotect_secret(encrypted_b64: str) -> str:
        try:
            raw = base64.b64decode(encrypted_b64.encode("ascii")).decode("utf-8")
        except Exception as err:
            raise ValueError("Invalid encrypted token encoding.") from err
        if raw.startswith("non_win_mock:"):
            return raw[len("non_win_mock:"):]
        raise ValueError("Invalid mock token format.")
