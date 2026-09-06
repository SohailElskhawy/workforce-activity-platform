# WorkLens Agent employee installation

## Install and enroll

1. Download `WorkLensAgentSetup.exe` from your WorkLens administrator.
2. Double-click it and complete the normal Windows installer. Windows may ask for administrator approval because the app is installed under Program Files.
3. When the **Enroll WorkLens Agent** window appears, enter the hosted WorkLens URL, device ID, and device token supplied by your manager.
4. Select **Enroll**. The app verifies the device with WorkLens before it saves anything.
5. Leave the agent running. It collects only from your Windows sign-in session.

You do not need Python, pip, PowerShell, a virtual environment, an `.env` file, or a terminal.

## Restarting the computer

No reconfiguration or reinstallation is needed after a restart. The installer creates a Windows Startup entry for the signed-in employee, so WorkLens Agent starts automatically each time that employee logs in. It runs in that user session so Windows foreground-window and idle detection remain available.

If the computer starts without internet access, the agent continues collecting and keeps pending activity locally. It uploads the queued activity when the connection returns.

## Reconfigure a device

Open **Start** > **WorkLens Agent** > **Configure WorkLens Agent**. Your manager must supply a valid device ID and token. A failed enrollment attempt does not replace the current working configuration.

## Local data and privacy

WorkLens keeps its local configuration, SQLite delivery queue, and operational log under:

```text
%LOCALAPPDATA%\WorkLens
```

This includes `config.json`, `activity.db`, and `logs\agent.log`. The installer never puts this changing data under Program Files.

## Uninstall

Open **Settings** > **Apps** > **Installed apps**, find **WorkLens Agent**, and choose **Uninstall**. This removes the application, Windows Startup entry, device configuration, local queue, and logs. Queued activity that has not yet uploaded is permanently removed.
