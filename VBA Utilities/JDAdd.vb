Option Explicit
Sub AddJDNumber()
    
    ' Get the number to place inside of the [brackets]
    ' Brackets not required, if no number given, exit cleanly
    Dim johnnyDecimalTagNumber As String
        johnnyDecimalTagNumber = InputBox("Enter the Johnny Decimal Tag Number" & vbCrLf & "With NO `[]`'s")
    If johnnyDecimalTagNumber = "" Then
        GoTo CLEAN_EXIT:
    End If
    
    Dim objItem  As Object
    ' For each item selected
    For Each objItem In ActiveExplorer.Selection
        ' If it's an email
        If objItem.MessageClass = "IPM.Note" Then
            Dim strTemp As String
            ' Modify the original email subject line string and add the johnny decimal tag number
            ' Then assign it to a temp variable
            strTemp = objItem.Subject & " [" & johnnyDecimalTagNumber & "]"
            ' Make the email subject line equal to the temp string
            objItem.Subject = strTemp
            objItem.Save
        End If
    Next objItem
    
CLEAN_EXIT:
Set objItem = Nothing
End Sub
