Option Explicit
'======================================================================================='
Public Function GetCurrentItem() As Object
    ' Instantiate an Outlook application instance
    Dim objApp As Outlook.Application
        Set objApp = Application

    ' Don't nuke the process if something breaks
    On Error Resume Next

    ' Depending on Which type of active window is active in Outlook
    Select Case TypeName(objApp.ActiveWindow)
        Case "Explorer"
            ' If explorer than grab the current active selection
            Set GetCurrentItem = objApp.ActiveExplorer.Selection.Item(1)
        Case "Inspector"
            ' If Inspector than grab the current item
            Set GetCurrentItem = objApp.ActiveInspector.CurrentItem
    End Select
    ' Tidy up and de-allocate the Outlook instance
    Set objApp = Nothing
End Function
'======================================================================================='
' STRING CLEANING SUBROUTINE
Public Sub ReplaceCharsForFileName(temporarySubjectLineString As String, sChr As String)
    ' This just cleans the Email subject line of invalid characters
    temporarySubjectLineString = Replace(temporarySubjectLineString, "/", sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, "\", sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, ":", sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, "?", sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, Chr(34), sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, "<", sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, ">", sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, "|", sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, "[", sChr)
    temporarySubjectLineString = Replace(temporarySubjectLineString, "]", sChr)
End Sub
'======================================================================================='
Public Function formatName(str As String, personNameStartChar As String) As String
    ' Meeting attendee names are formatted strangely
    ' This function parses the attendees and formats them to:
    ' [[@Bryan Jenks]]
    Dim typeOfNameToClean As Integer
    
    ' If attendee is an outside Active Directory individual
    ' like a gmail account or external person then the display
    ' is just first and last names. these are perfect to easily format
    ' ex: `Bryan Jenks`
    Dim regexJustFirstNameAndLastName As Object
        Set regexJustFirstNameAndLastName = New RegExp
        regexJustFirstNameAndLastName.Pattern = "^\w+\s\w+$"
    If regexJustFirstNameAndLastName.Test(str) = True Then typeOfNameToClean = 1
    Set regexJustFirstNameAndLastName = Nothing
    
    ' This finds emails that are `last name, first name@domain.com`
    ' not just `.com` will also pick up multiples like
    ' ex: `@domain.or.gov` etc
    Dim regexFirstNameLastNameAndFullDomain As Object
        Set regexFirstNameLastNameAndFullDomain = New RegExp
        regexFirstNameLastNameAndFullDomain.Pattern = "^\w+,\s\w+@\w+(\.\w+)+"
    If regexFirstNameLastNameAndFullDomain.Test(str) = True Then typeOfNameToClean = 2
    Set regexFirstNameLastNameAndFullDomain = Nothing
    
    ' A full and normal email only as the invited person
    ' ex: johndoe@domain.com
    Dim regexPlainEmailAddress As Object
        Set regexPlainEmailAddress = New RegExp
        regexPlainEmailAddress.Pattern = "^\w+@\w+\.\w+"
    If regexPlainEmailAddress.Test(str) = True Then typeOfNameToClean = 3
    Set regexPlainEmailAddress = Nothing
    
    ' Active Directory people that display like:
    'ex: `Last Name, First Name (AGENCY)`
    Dim regexLastNameFirstNameAndAgency As Object
        Set regexLastNameFirstNameAndAgency = New RegExp
        regexLastNameFirstNameAndAgency.Pattern = "^[a-zA-Z_\-]+,\s[a-zA-Z_\-]+\s\(\w+\)$"
    If regexLastNameFirstNameAndAgency.Test(str) = True Then typeOfNameToClean = 4
    Set regexLastNameFirstNameAndAgency = Nothing
    
    ' Single name entity such as a distribution list or 1 word titled entity
    ' ex: `payroll (Agency)`
    Dim regexSingleNameAndDomain As Object
        Set regexSingleNameAndDomain = New RegExp
        regexSingleNameAndDomain.Pattern = "^([a-zA-Z_\-]+\s)+\([a-zA-Z_\-]+\)"
    If regexSingleNameAndDomain.Test(str) = True Then typeOfNameToClean = 5
    Set regexSingleNameAndDomain = Nothing
    
    Select Case typeOfNameToClean
        Case 1 ' John Doe
            formatName = "[[" & personNameStartChar & str & "]]"
        Case 2 ' Doe, John@domain.or.gov
            Dim fname As String, lname As String
            fname = Mid(str, InStr(str, ", ") + 2, InStr(str, "@") - (InStr(str, ", ") + 2))
            lname = Mid(str, 1, InStr(str, ",") - 1)
            ' Assemble the building blocks and assigning to return value
            formatName = "[[" & personNameStartChar & fname & " " & lname & "]]"
        Case 3 ' JohnDoe@gmail.com
            formatName = "[[" & personNameStartChar & Left(str, InStr(str, "@") - 1) & "]]"
        Case 4 ' Doe, John (Agency)
            Dim fname1 As String, lname1 As String
            fname1 = Mid(str, InStr(str, ", ") + 2, InStr(str, " (") - (InStr(str, ", ") + 2))
            lname1 = Mid(str, 1, InStr(str, ",") - 1)
            ' Assemble the building blocks and assigning to return value
            formatName = "[[" & personNameStartChar & fname1 & " " & lname1 & "]]"
        Case 5 ' Payroll (Agency)
            formatName = "[[" & Left(str, InStr(str, " (") - 1) & "]]"
        Case Else ' Anything else
            formatName = "[[" & str & "]]"
    End Select

End Function
'======================================================================================='