Option Explicit
Sub RemoveJDNumber()
    
    On Error GoTo CLEAN_EXIT:
    Dim objItem  As Object
    For Each objItem In ActiveExplorer.Selection
        If objItem.MessageClass = "IPM.Note" Then
            ' Hold the value of the email subject line string
            Dim strTemp As String
            strTemp = objItem.Subject
            
            Dim characterIndexPosition As Long, character As String
            ' Loop in reverse starting from the end of the email until a `[` is encountered
            ' Then use Left() to remove 1 entire Johnny Decimal Tag
            For characterIndexPosition = Len(strTemp) To 1 Step -1
                character = Mid(strTemp, characterIndexPosition, 1)
                If character = Chr(91) Then
                    strTemp = Left(strTemp, characterIndexPosition - 1)
                    objItem.Subject = strTemp
                    objItem.Save
                    GoTo NEXT_ITEM:
                End If ' End if character = `[`
            Next characterIndexPosition
        End If ' End if item is an email "IPM.Note"
NEXT_ITEM:
    Next objItem
CLEAN_EXIT:
    Set objItem = Nothing
End Sub
