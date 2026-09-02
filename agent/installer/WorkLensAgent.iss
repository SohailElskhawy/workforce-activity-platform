#ifndef SourceDir
  #define SourceDir "..\dist\WorkLensAgent"
#endif

[Setup]
AppId={{50C7A339-9BE1-4C4B-A44E-653CB8087679}
AppName=WorkLens Agent
AppVersion=0.1.0
AppPublisher=WorkLens
DefaultDirName={autopf}\WorkLens Agent
DefaultGroupName=WorkLens Agent
DisableProgramGroupPage=yes
OutputBaseFilename=WorkLensAgentSetup
UninstallDisplayName=WorkLens Agent
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Configure WorkLens Agent"; Filename: "{app}\WorkLensAgent.exe"; Parameters: "--enroll"; WorkingDir: "{localappdata}\WorkLens"; IconFilename: "{app}\WorkLensAgent.exe"
Name: "{userstartup}\WorkLens Agent"; Filename: "{app}\WorkLensAgent.exe"; Parameters: "--mode real"; WorkingDir: "{localappdata}\WorkLens"; IconFilename: "{app}\WorkLensAgent.exe"

[Run]
Filename: "{app}\WorkLensAgent.exe"; Parameters: "--enroll"; Description: "Enroll WorkLens Agent"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\WorkLens"
