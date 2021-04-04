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
</p>

<!-- Description -->

> A combination of a template vault with initial structure and some Microsoft Office VBA Macros to facilitate a powerful, extensible, and flexible plain text workflow using Microsoft Office and Obsidian For Business.

## Table of Contents

- [Obsidian For Business](#obsidian-for-business)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Requirements](#requirements)
    - [Recommended](#recommended)
  - [Installation](#installation)
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

- Easy Johnny Decimal tagging and refactorting of emails en-masse
- Extract emails and calendar meetings to plain text straight to your vault
- Easy configuration of several facets of this system in [USER_CONFIG](USER_CONFIG.vb)
- A template business vault to get you started using `Obsidian For Business`

## Requirements

[Return To Top](#table-of-contents)

- For the VBA Tools
  - Microsoft Windows
  - Microsoft Office 
  - Microsoft Office VBA libraries activated
    - Microsoft Forms 2.0 Object Library
    - Microsoft VBScript Regular Expressions 5.5
- For the Vault
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
2. Take the `vault/` directory and rename it to what ever you want your business vault to be named
3. Open that folder in [Obsidian](https://obsidian.md/) as a new vault
4. Explore, play, find out what works and doesn't and change what ever you'd like

<!-- TODO Document the VBA Process with screen shots  -->
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

<!-- TODO Advice for QA tool bar for macros -->

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
