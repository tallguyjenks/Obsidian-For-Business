# Obsidian For Business

<!-- Header & Preview Image -->
<center>
  <img src="./images/banner.png" height="50%">
</center>

<!-- Shields -->
<p align="center">
  <a href="https://github.com/tallguyjenks/Obsidian-For-Business/blob/master/LICENSE">
    <img src="https://img.shields.io/static/v1.svg?style=flat&label=License&message=MIT&logoColor=eceff4&logo=github&colorA=black&colorB=green"/>
  </a>
  <img src="https://img.shields.io/github/commit-activity/m/tallguyjenks/Obsidian-For-Business">
  <a href="https://github.com/tallguyjenks/Obsidian-For-Business/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/tallguyjenks/Obsidian-For-Business">
  </a>
  <img src="https://img.shields.io/github/v/release/tallguyjenks/Obsidian-For-Business">
  <a href="https://wakatime.com/badge/github/tallguyjenks/Obsidian-For-Business">
    <img src="https://wakatime.com/badge/github/tallguyjenks/Obsidian-For-Business.svg"> 
  </a>
</p>

<!-- Description -->

> A combination of a template vault with initial structure and some Microsoft Office VBA Macros to facilitate a powerful, extensible, and flexible plain text workflow using Microsoft Office and Obsidian For Business.

**If you enjoy this product and want to support it's development consider GitHub Sponsor ship:**

<!-- GitHub Sponsor -->
<h3 align="center">
    <a href="https://github.com/sponsors/tallguyjenks" target="_blank">👉 Sponsor this Work 👈</a>
</h3>

## Table of Contents

- [Obsidian For Business](#obsidian-for-business)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Requirements](#requirements)
    - [Recommended](#recommended)
  - [Installation](#installation)
    - [Getting the Outlook Utilities Installed](#getting-the-outlook-utilities-installed)
    - [Users](#users)
    - [Contributors](#contributors)
  - [Usage](#usage)
    - [Example](#example)
  - [Documentation](#documentation)
  - [Resources](#resources)
  - [Development](#development)
    - [Security](#security)
    - [Future](#future)
    - [History](#history)
    - [Community](#community)
  - [Credits](#credits)
  - [License](#license)

## Features

[Return To Top](#table-of-contents)

- A template business vault to get you started using `Obsidian For Business`
- Easy Johnny Decimal tagging and refactorting of emails en-masse
  - Select email(s) and run the `JDAdd` macro and you type in a tag like: `12.04` and all your email subject lines will get a `[12.04]` tag added to the end of the subject line for easy searching described more in detail [HERE](https://johnnydecimal.com/concepts/managing-email/)
  - To easily remove an entire tag from email(s) select them all and run `JDRemove` and 1 tag will be removed from the end of the subject line
  - Conversation view groups will not display the tag only the individual email items
- Extract emails and calendar meetings to plain text straight to your vault
  - Select any number of emails in the interface and run the `SaveEmail` utility and each email will be extracted to the designated vault file path set in [USER_CONFIG](USER_CONFIG.vb)
- Extract meeting attdendees and details by selecting a single meeting at a time in the calendar interface and running `SaveMeeting` and the detailes will be extracted to the designated vault file path set in [USER_CONFIG](USER_CONFIG.vb) 
- Several facets of this system are configured and documented in [USER_CONFIG](USER_CONFIG.vb)

## Requirements

[Return To Top](#table-of-contents)

- For the VBA Tools
  - Microsoft Windows
  - Microsoft Office
  - Microsoft Office VBA libraries activated
    - Microsoft Forms 2.0 Object Library
    - Microsoft VBScript Regular Expressions 5.5
- For the TEMPLATE_VAULT
  - Obsidian

### Recommended

[Return To Top](#table-of-contents)

- Latest Versions of Obsidian and Recommended Community Plugins

## Installation

[Return To Top](#table-of-contents)

1. Download the repo through any means 
   - GitHub CLI
   - SSH
   - HTTPS
   - a `.zip` etc.
2. Take the `TEMPLATE_VAULT/` directory and rename it to what ever you want your business vault to be named
3. Open that folder in [Obsidian](https://obsidian.md/) as a new vault
4. Explore, play, find out what works and doesn't and change what ever you'd like

### Getting the Outlook Utilities Installed

1. Open Outlook
2. press & hold <kbd>Alt</kbd> then press <kbd>f11</kbd>
3. The Visual Basic Editor will open and you'll see something that looks like this:

![vba1](images/vba1.png)

4. The first thing we need to do is activate some library references
5. Go to `Tools > References`

![vba2](images/vba2.png)

6. and you'll see this dialog box open. 
7. Ensure all these items are selected if they are not, find them and select them. Namely the 2 necessary ones are
    - Microsoft Forms 2.0 Object Library
    - Microsoft VBScript Regular Expressions 5.5

![vba3](images/vba3.png)

If you cant find things like `Microsoft Office 16.0 Object Library` don't worry, you might not have the latest versions. IF you encounter any issues please file a bug report but It is unlikely you'll encounter many issues if any with these tools.


8. Next we need to get the code into the Outlook Application. This is sadly a manual process given how antiquated the toolset is so apologies but you'll need to copy/paste and rename the macros you decide to use in Outlook.
9. To start click the depicted button and select `Module` for every `.vb` file you want to use in this workflow:

![vba4](images/vba4.png)

10. Name the files exactly as you see listed below. To change the name of a new module you'll use the `Properties` window as shown below. It should automatically be visible when you open the Editor with the hotkey combo from earlier

![vba5](images/vba5.png)

By itself these steps allow you to use the macros but it's not a very userfriendly experience. To see my recommended setup for these macros see [Usage](#usage).

### Users

[Return To Top](#table-of-contents)

There should be no administrative privledges required for any of these tools at any time for any reason. As well as no requirement for any passwords, credentials or any user information what so ever.

See [Usage](#usage)

### Contributors

[Return To Top](#table-of-contents)

None yet! But PR's welcome!

See [CONTRIBUTING](#contributing)

## Usage

[Return To Top](#table-of-contents)

Now that you've finished installing the code from [Installation](#getting-the-outlook-utilities-installed) We need to make a more friendly experience for their usage.

We will do this using the `Quick Access Toolbar in Outlook`.

1. At the top of your Outlook application there will be a little down arrow icon and some other icons in the top left of the application. 

![QA1](images/QA1.png)

2. Click the down arrow and select the `More Commands` option

![QA2](images/QA2.png)

3. You'll get a screen that looks similar to this, under the `Choose commands from` drop down select `Macros` and you'll see a list of the code files we added.
4. because of the way VBA works you cant name the functions the same as the modules so thats why the names differ but it should be fairly obvious which are which.
5. Select the macro items and click the `Add >>` button to move them to the Quick Access Toolbar menu (`<Separators>` are useful for visually separating groups of commands)

![QA3](images/QA3.png)

6. Now we can get a little more aesthetic and select a Macro on the right hand side of the dialog box then click `Modify...`

![QA4](images/QA4.png)

7. This will let you select a custom icon to display on the Quick Access Toolbar for the macro so they are a little more intuitive to view
8. When finished click `Ok` until all menus and windows are closed

![QA5](images/QA5.png)

With that all done you'll have some icons on your Quick Access Toolbar to click for your automated actions but to take it a step further, if you simply press <kbd>Alt</kbd> the Quick Access Toolbar will highlight the icons with numbers so you can simply press a number afterwards to run the action for an entirely keyboard-centric workflow:

![QA6](images/QA6.png)



### Example

[Return To Top](#table-of-contents)

<++>

## Documentation

[Return To Top](#table-of-contents)

- See [The Wiki](https://github.com/tallguyjenks/Obsidian-For-Business/wiki)

## Resources

[Return To Top](#table-of-contents)

- [Obsidian](https://obsidian.md/)
- [Bryan's YouTube Channel (Lots of Obsidian Videos)](https://www.youtube.com/c/BryanJenksTech?sub_confirmation=1)

## Development

[Return To Top](#table-of-contents)

- Development should take place on a Windows machine.
  - Given that VBA was made in '93 legacy'd in '08 little has changed so you can still easily use older code and machines. 
  - Only thing is that the newer versions of MS Office might be recommended because of the additions to the Object Library for VBA and i'm not sure if there would be anything missing from what versions of the libraries.
- Helpful tools with VBA that I have yet ot implement well with this project are:
    <!-- TODO Implement these tools into the project -->
  - [The Rubberduck IDE](https://github.com/rubberduck-vba/Rubberduck)
  - [VBA Sync Version Control Helper](https://github.com/chelh/VBASync/) 

See [CONTRIBUTING](CONTRIBUTING.md)

### Security

[Return To Top](#table-of-contents)

- There are no required credentials or escalation of privledges and no data being dealt with outside of the local machine. There shouldn't be any security issues but if you think of anything please:

See [SECURITY](SECURITY.md)

### Future

[Return To Top](#table-of-contents)

- Ideally i'd like to further improve upon the code base using the additional VBA dev tools listed under [Development](#development) to batter manage the code.
- For now i'd like to squash bugs, expand the regex options for email formats that appear so the extractors work as intended and after reaching a level of stability, just expand feature requests.

See [ROADMAP](ROADMAP.md)

### History

[Return To Top](#table-of-contents)

- **2021-04-04** Codebase Is Opensourced!

See [RELEASES](https://github.com/tallguyjenks/Obsidian-For-Business/releases)

### Community

[Return To Top](#table-of-contents)

See [CODE OF CONDUCT](CODE_OF_CONDUCT.md)

## Credits

[Return To Top](#table-of-contents)

- Thank you to everyone who contributes to this project.
- If you contribute to this project do add a PR for [AUTHORS](AUTHORS.md) as well!

See [AUTHORS](AUTHORS.md)

## License

[Return To Top](#table-of-contents)

See [LICENSE](LICENSE)

---


<!-- Buy me a coffee -->
<h3 align="center">
<a href="https://www.buymeacoffee.com/tallguyjenks" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>
</h3>
