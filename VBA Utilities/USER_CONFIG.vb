Option Explicit

Public Sub config(vaultPathToSaveFileTo As String, personNameStartChar As String, Optional emailFileNameStartChr As String, Optional emailTypeLink As String, Optional meetingFileNameStartChr As String, Optional meetingTypeLink As String, Optional trainingFileNameStartChr As String, Optional trainingTypeLink As String)
    '================================================'
    '====DECLARE=YOUR=FILE=PATH=TO=SAVE=FILES=TO====='
    '================================================'
    ' Make sure this is the absolute path where you want your files to be sent to
    ' !IMPORTANT! make sure you have a trailing backslash at the end of the path `\`
    vaultPathToSaveFileTo = "C:\Users\bjenks\Desktop\Vault\"
    '================================================'
    ' This is what is added to the links inside the produced documents for people
    ' so it would look like:
    ' ex: "[[@Bryan Jenks]]"
    personNameStartChar = "@"
    '================================================'
    
    
    ' ^^^^^^^^^^^^^^^^^^^^^^^
    ' THE ABOVE ARE MANDATORY
    '
    ' 
    ' 
    ' 
    ' THE BELOW ARE OPTIONAL
    ' VVVVVVVVVVVVVVVVVVVVVVV
    
    
    
    ' This is the beginning of the email file name and the H1 heading inside the file
    ' You need to leave a space in this if you want the name to appear like it does above
    ' ex: "E 2021-03-27 1347 Email Subject line here"
    emailFileNameStartChr = "E "
    '================================================'
    ' This is the beginning of the Meeting file name and the H1 heading inside the file
    ' You need to leave a space in this if you want the name to appear like it does above
    ' ex: "M 2021-03-27 1347 Meeting Subject Here"
    meetingFileNameStartChr = "M "
    '================================================'
    ' This is the beginning of the Training file name and the H1 heading inside the file
    ' You need to leave a space in this if you want the name to appear like it does above
    ' ex: "T 2021-03-27 1347 My Training Subject Here"
    trainingFileNameStartChr = "T "

    '================================================'
    ' These set the meta data links in the files so that there is a file named
    ' `+.md` that links to all emails. It's another way of sifting through your data
    ' You do not need to use these. To turn them off just leave a pair of empty quotes
    ' if left on they produce a field in the saved files that looks like:
    ' ex: "- `Type: ` [[+]]"
    emailTypeLink = "[[+]]"
    meetingTypeLink = "[[&]]"
    trainingTypeLink = "[[!]]"
    
End Sub

