Option Explicit
'======================================================================================='
Sub GetAttendeeList(meetingType As String)

    Dim vaultPathToSaveFileTo As String
    Dim personNameStartChar As String


    Dim trainingFileNameStartChr As String
    Dim trainingTypeLink As String

    Dim meetingFileNameStartChr As String
    Dim meetingTypeLink As String

    Dim fileNameStartChr As String
    Dim typeLink As String


    Select Case meetingType
        Case "Meeting"
            config vaultPathToSaveFileTo, personNameStartChar, , , meetingFileNameStartChr, meetingTypeLink
            ' use the meeting data variables
            fileNameStartChr = meetingFileNameStartChr
            typeLink = meetingTypeLink
        Case "Training"
            config vaultPathToSaveFileTo, personNameStartChar, , , , , trainingFileNameStartChr, trainingTypeLink
            ' use the training data variables
            fileNameStartChr = trainingFileNameStartChr
            typeLink = trainingTypeLink
    End Select



    ' Instantiate an Outlook application instanc
    Dim objApp As Outlook.Application
        Set objApp = CreateObject("Outlook.Application")
    ' Grab the currently selected item by using the function declare above
    Dim objItem As Object
        Set objItem = GetCurrentItem()
        Dim objAttendees As Outlook.Recipients
            ' For the currently selected item, we're getting a copy of the recipients
            Set objAttendees = objItem.Recipients

    ' If something breaks, skip to the end, tidy up and shut the door
    On Error GoTo EndClean:

    ' Is it an appointment
    If objItem.Class <> 26 Then
      MsgBox "This code only works with meetings."
      GoTo EndClean: ' you broke it
    End If
    '=======================================================
    ' Get the data
    Dim dtStart As Date
        dtStart = objItem.Start

    Dim dtEnd As Date
        dtEnd = objItem.End

    Dim strSubject As String
        strSubject = objItem.Subject
        ' Clean up meeting title of invalid characters
        ReplaceCharsForFileName strSubject, ""

    Dim strLocation As String
        strLocation = objItem.Location

    Dim strNotes As String
        strNotes = objItem.Body

    Dim objOrganizer As String
        objOrganizer = objItem.Organizer

    Dim objAttendeeReq As String
        objAttendeeReq = ""

    Dim objAttendeeOpt As String
        objAttendeeOpt = ""
    '=======================================================
    ' ListAttendees is really just an email item now
    Dim ListAttendees As MailItem
        Set ListAttendees = Application.CreateItem(olMailItem)
    '=======================================================
    ' Get The Attendee List
    Dim x As Long
    Dim attendeeName As String
    ' For each recipient on the selected meeting
    For x = 1 To objAttendees.Count
      ' For `REQUIRED` Attendee's Separate them out
      If objAttendees(x).Type = olRequired Then
          ' Format Names of attendees correctly
            attendeeName = formatName(objAttendees(x).name, personNameStartChar)
          ' Building a long formatted string with records that look like:
          ' - [[@Bryan Jenks]]\n
          objAttendeeReq = objAttendeeReq & vbTab
          objAttendeeReq = objAttendeeReq & "- "
          objAttendeeReq = objAttendeeReq & attendeeName
          objAttendeeReq = objAttendeeReq & vbCrLf
      Else ' For `OPTIONAL` Attendee's Separate them out
          ' Format optional Attendee names
          attendeeName = formatName(objAttendees(x).name, personNameStartChar)

          objAttendeeOpt = objAttendeeOpt & vbTab
          objAttendeeOpt = objAttendeeOpt & "- "
          objAttendeeOpt = objAttendeeOpt & attendeeName
          objAttendeeOpt = objAttendeeOpt & vbCrLf
      End If
    Next
    '=======================================================
    Dim strCopyData As String

    ' Begin building the final plain text report out

    strCopyData = ""
    strCopyData = strCopyData & "# [[" & fileNameStartChr & Format(dtStart, "yyyy-mm-dd hhMM") & " " & strSubject & "|" & strSubject & "]]"
    strCopyData = strCopyData & vbCrLf & vbCrLf & vbCrLf

    strCopyData = strCopyData & "- `Organizer:` " & formatName(objOrganizer, personNameStartChar)
    strCopyData = strCopyData & vbCrLf

    strCopyData = strCopyData & "- `Location:` " & "[[" & strLocation & "]]"
    strCopyData = strCopyData & vbCrLf

   strCopyData = strCopyData & "- `Start:` "
    strCopyData = strCopyData & "[[" & Format(dtStart, "yyyy-mm-dd") & "]] " & Format(dtStart, "hh:MM:ss AM/PM")
    strCopyData = strCopyData & vbCrLf

    strCopyData = strCopyData & "- `End:` "
    strCopyData = strCopyData & "[[" & Format(dtEnd, "yyyy-mm-dd") & "]] " & Format(dtEnd, "hh:MM:ss AM/PM")
    strCopyData = strCopyData & vbCrLf & vbCrLf


    strCopyData = strCopyData & "- `Type:` " & typeLink
    strCopyData = strCopyData & vbCrLf & vbCrLf


   strCopyData = strCopyData & "- `Required:` "
    strCopyData = strCopyData & vbCrLf
    strCopyData = strCopyData & objAttendeeReq
    strCopyData = strCopyData & vbCrLf

    strCopyData = strCopyData & "- `Optional:` "
    strCopyData = strCopyData & vbCrLf
    strCopyData = strCopyData & objAttendeeOpt
    strCopyData = strCopyData & vbCrLf & vbCrLf

    strCopyData = strCopyData & "#### NOTES "
    strCopyData = strCopyData & vbCrLf & vbCrLf
    strCopyData = strCopyData & vbCrLf
    strCopyData = strCopyData & strNotes


    Const OLTXT = 0

    ' Put the output into the Email item body
    ListAttendees.Body = strCopyData

    Dim fileName As String
    fileName = fileNameStartChr & Format(dtStart, "yyyy-mm-dd hhMM") & " " & strSubject & ".md"

    ListAttendees.SaveAs vaultPathToSaveFileTo & fileName, OLTXT


    ' Tidy up and shut the door
EndClean:
    Set objApp = Nothing
    Set objItem = Nothing
    Set objAttendees = Nothing
End Sub

Sub ExtractMeeting()
    GetAttendeeList "Meeting"
End Sub

Sub ExtractTraining()
    GetAttendeeList "Training"
End Sub
