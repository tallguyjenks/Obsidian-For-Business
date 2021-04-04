Option Explicit
'======================================================================================='
Sub ExtractEmail()

    Dim vaultPathToSaveFileTo As String
    Dim emailFileNameStartChr As String
    Dim emailTypeLink As String
    Dim personNameStartChar As String
    config vaultPathToSaveFileTo, personNameStartChar, emailFileNameStartChr, emailTypeLink

    '================================================'
    ' Save as plain text
    Const OLTXT = 0
    ' Object holding variable
    Dim obj As Object
    ' Instantiate an Outlook Email Object
    Dim oMail As Outlook.MailItem
    ' If something breaks, skip to the end, tidy up and shut the door
    On Error GoTo EndClean:
    ' Establish the environment and selected items (emails)
    ' NOTE: selecting a conversation-view stack wont work
    '       you'll need to select one of the emails
    Dim fileName As String
    Dim temporarySubjectLineString As String
    Dim currentExplorer As Explorer
        Set currentExplorer = Application.ActiveExplorer
    Dim Selection As Selection
        Set Selection = currentExplorer.Selection
    ' For each email in the Selection
    ' Assigning email item to the `obj` holding variable
    For Each obj In Selection
        ' set the oMail object equal to that mail item
        Set oMail = obj
        ' Is it an Email?
        If oMail.Class <> 43 Then
          MsgBox "This code only works with Emails."
          GoTo EndClean: ' you broke it
        End If

        ' Yank the mail items subject line to `temporarySubjectLineString`
        temporarySubjectLineString = oMail.Subject
        ' function call the name cleaner to remove any
        '    illegal characters from the subject line
        ReplaceCharsForFileName temporarySubjectLineString, ""
        ' Yank the received date-time to a holding variable

        ' Build Recipient string based on receipient collection
        Dim recips As Outlook.Recipients
            Set recips = oMail.Recipients
        Dim recip As Outlook.Recipient
        Dim result As String
        Dim recipString As String
            recipString = ""

        For Each recip In recips
            recipString = recipString & vbTab
            recipString = recipString & "- "
            recipString = recipString & formatName(recip.name, personNameStartChar)
            recipString = recipString & vbCrLf
        Next
        ' Build the result file content to be sent to the mail item body
        ' Then save that mail item same as the meeting extractor
        Dim sender As String
            sender = formatName(oMail.sender, personNameStartChar)
        Dim dtDate As Date
            dtDate = oMail.ReceivedTime
        Dim resultString As String

        resultString = ""
        resultString = resultString & "# [[" & emailFileNameStartChr & Format(oMail.ReceivedTime, "yyyy-mm-dd hhnn") & " " & temporarySubjectLineString & "|" & temporarySubjectLineString & "]]"
        resultString = resultString & vbCrLf & vbCrLf & vbCrLf

        resultString = resultString & "- `From:` " & vbCrLf
        resultString = resultString & vbTab & "- " & sender
        resultString = resultString & vbCrLf

        resultString = resultString & "- `To:` " & vbCrLf
        resultString = resultString & recipString
        resultString = resultString & vbCrLf

        resultString = resultString & "- `Received:` "
        resultString = resultString & "[[" & Format(oMail.ReceivedTime, "yyyy-mm-dd") & "]] "
        resultString = resultString & Format(oMail.ReceivedTime, "hh:MM AM/PM")
        resultString = resultString & vbCrLf

        resultString = resultString & "- `Type:` " & emailTypeLink
        resultString = resultString & vbCrLf & vbCrLf & vbCrLf

        resultString = resultString & "---"
        resultString = resultString & vbCrLf & vbCrLf & vbCrLf

        resultString = resultString & oMail.Body

        ' Make a dummy email to hold the details we're saving
        ' This way we dont get junk in the message header when saving
        Dim outputItem As MailItem
            Set outputItem = Application.CreateItem(olMailItem)
        outputItem.Body = resultString

        ' Now we create the file name
        fileName = emailFileNameStartChr
        fileName = fileName & Format(dtDate, "yyyy-mm-dd", vbUseSystemDayOfWeek, vbUseSystem)
        fileName = fileName & Format(dtDate, " hhMM", vbUseSystemDayOfWeek, vbUseSystem)
        fileName = fileName & " " & temporarySubjectLineString & ".md"

        ' Save the result
        outputItem.SaveAs vaultPathToSaveFileTo & fileName, OLTXT

    Next
EndClean:
    Set obj = Nothing
    Set oMail = Nothing
    Set outputItem = Nothing
End Sub
