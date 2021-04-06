Option Explicit
Sub ExportOutlookAddressBook()

    Dim olApp As Outlook.Application
    Set olApp = Outlook.Application
        Dim olNS As Outlook.NameSpace
        Set olNS = olApp.GetNamespace("MAPI")
            Dim olAL As Outlook.AddressList
            Set olAL = olNS.AddressLists("Contacts") 'Change name if different contacts list name
    Dim olEntry As Outlook.AddressEntry
    Dim contact 'The contact to extract

    Dim vaultPathToSaveFileTo As String
    Dim personNameStartChar As String
    Dim contactFileNameStartChr As String
    Dim contactTypeLink As String
    ' Get the configuration settings
    config vaultPathToSaveFileTo, personNameStartChar, , , , , , , contactFileNameStartChr, contactTypeLink

    ' Make a dummy email to hold the details we're saving
    ' This way we dont get junk in the message header when saving
    Dim outputItem As MailItem
        Set outputItem = Application.CreateItem(olMailItem)

     Set contact = GetCurrentItem()
     Debug.Print ""
     Debug.Print ""
     Debug.Print ""
     Debug.Print ""
     Debug.Print ""
     Debug.Print contact.Account 'display name
     Debug.Print contact.BusinessAddressStreet
     Debug.Print contact.BusinessAddressCity
     Debug.Print contact.BusinessAddressState
     Debug.Print contact.BusinessAddressPostalCode
     Debug.Print contact.BusinessAddressCountry
     
     Debug.Print contact.BusinessTelephoneNumber
     Debug.Print contact.MobileTelephoneNumber
     Debug.Print contact.Email1DisplayName 'displayname
     Debug.Print contact.FullName 'displayname
     Debug.Print contact.FirstName
     Debug.Print contact.LastName
     Debug.Print contact.IMAddress 'email
     
     
     Dim resultString As String
        

    resultString = ""
    resultString = resultString & "# [[" & contactFileNameStartChr & contact.FirstName & " " & contact.LastName & "]]"
    resultString = resultString & vbCrLf & vbCrLf & vbCrLf

    resultString = resultString & "- `Type:` " & contactTypeLink & vbCrLf
    resultString = resultString & vbCrLf

    resultString = resultString & "- `Keywords:` " & vbCrLf
    resultString = resultString & vbCrLf

    resultString = resultString & "- `Classification:` " & vbCrLf
    resultString = resultString & vbCrLf

    resultString = resultString & "- `Team:` "
    resultString = resultString & vbCrLf

    resultString = resultString & "- `Email:` "
    resultString = resultString & "[" & contact.FirstName & " " & contact.LastName & "]"
    resultString = resultString & "(mailto:" & contact.IMAddress & ")"
    resultString = resultString & vbCrLf

    resultString = resultString & "- `Birthday:` "
    resultString = resultString & vbCrLf

    resultString = resultString & "- `Datapoints:` "
    resultString = resultString & vbCrLf & vbCrLf & vbCrLf


    resultString = resultString & "---"
    resultString = resultString & vbCrLf & vbCrLf & vbCrLf


    resultString = resultString & "### Meetings" & vbCrLf & vbCrLf
    resultString = resultString & "```dataview" & vbCrLf
    resultString = resultString & "table file.ctime.year as CY, file.ctime.month as CM, file.ctime.day as CD, file.mtime.year as MY, file.mtime.month as MM, file.mtime.day as MD" & vbCrLf
    resultString = resultString & "from [[" & contactFileNameStartChr & contact.FirstName & " " & contact.LastName & "]] and #Meetings" & vbCrLf
    resultString = resultString & "limit 10" & vbCrLf
    resultString = resultString & "sort file.ctime desc" & vbCrLf
    resultString = resultString & "```" & vbCrLf & vbCrLf & vbCrLf


    resultString = resultString & "### Training" & vbCrLf & vbCrLf
    resultString = resultString & "```dataview" & vbCrLf
    resultString = resultString & "table file.ctime.year as CY, file.ctime.month as CM, file.ctime.day as CD, file.mtime.year as MY, file.mtime.month as MM, file.mtime.day as MD" & vbCrLf
    resultString = resultString & "from [[" & contactFileNameStartChr & contact.FirstName & " " & contact.LastName & "]] and #Training" & vbCrLf
    resultString = resultString & "limit 10" & vbCrLf
    resultString = resultString & "sort file.ctime desc" & vbCrLf
    resultString = resultString & "```" & vbCrLf & vbCrLf & vbCrLf


    resultString = resultString & "### Emails" & vbCrLf & vbCrLf
    resultString = resultString & "```dataview" & vbCrLf
    resultString = resultString & "table file.ctime.year as CY, file.ctime.month as CM, file.ctime.day as CD, file.mtime.year as MY, file.mtime.month as MM, file.mtime.day as MD" & vbCrLf
    resultString = resultString & "from [[" & contactFileNameStartChr & contact.FirstName & " " & contact.LastName & "]] and #Email" & vbCrLf
    resultString = resultString & "limit 10" & vbCrLf
    resultString = resultString & "sort file.ctime desc" & vbCrLf
    resultString = resultString & "```" & vbCrLf & vbCrLf & vbCrLf


    resultString = resultString & "### Mentions" & vbCrLf & vbCrLf
    resultString = resultString & "```dataview" & vbCrLf
    resultString = resultString & "table file.ctime.year as CY, file.ctime.month as CM, file.ctime.day as CD, file.mtime.year as MY, file.mtime.month as MM, file.mtime.day as MD" & vbCrLf
    resultString = resultString & "from [[" & contactFileNameStartChr & contact.FirstName & " " & contact.LastName & "]] and !#Email and !#Meetings and !#Training" & vbCrLf
    resultString = resultString & "limit 10" & vbCrLf
    resultString = resultString & "sort file.ctime desc" & vbCrLf
    resultString = resultString & "```" & vbCrLf & vbCrLf & vbCrLf

    outputItem.Body = resultString

    Dim fileName As String
    ' Now we create the file name
    fileName = contactFileNameStartChr
    fileName = fileName & contact.FirstName & " " & contact.LastName
    fileName = fileName & ".md"
    
    ' Save the result
    outputItem.SaveAs vaultPathToSaveFileTo & fileName, OLTXT
     
    Set olApp = Nothing
    Set olNS = Nothing
    Set olAL = Nothing

End Sub
