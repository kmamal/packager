
Set WshShell = WScript.CreateObject("WScript.Shell")
Set Args = WScript.Arguments
num = Args.Count

sargs = ""
for k = 0 to num - 1
	arg = Args.Item(k)
	sargs = sargs & " " & arg
next

path = WScript.ScriptFullName
WshShell.Run Left(path, Len(path) - 3) & "cmd" & sargs, 0, False
