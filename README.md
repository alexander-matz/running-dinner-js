# Running dinner assignments

This is a single page web app that is supposed to manage
the running dinner assignments for the VISUM Mannheim student initiative.

Disclaimer: This piece of software is currently tied to the city of Mannheim
but easily customizable for other cities by small number of minor changes in
the source code.

# Usage

Open the page, import a team by dragging a csv file into the field
that tells you to do so in the "Files" tab.
You can edit entries by double clicking them, just play around with
it.
Do some sanity checks on the adresses and click on "resolve"
addresses to retrieve the geo coordinates for the addresses.
Since this not always works perfectly well, suspicious coordinates
are highlighted red, check those on the map and drag + drop them
where they belong to.

In the "Rules" tab, you can specify some constraints, there's a
help on the side of that tab.

After you imported the teams, resolved their addresses and specified
rules, it is a good time to export everything so have a record of the
changes.
Go into the files tab and click the download buttons for teams and rules.

You can now start the matching. Go into the matching tab and click
"start matching", which generates a (really bad) initial matching.
Then click on "improve" and wait until the cost stops improving or
at least takes forever to improve.
The cost is an abstract measure that tells you how bad the current
matching is.
Everything above 1000 means that some team did not get their preferred
dish, a cost above 10000 means that teams meet twice during the
evening.
If you're happy with the matching, you can continue to generate mails
(or save it first).

Go into the mails tab and select the mail for the dish you want to
write in the drop down box.
You can (and have to) use variables in your mail, to see which variables
you can use, select the "HELP" entry in the drop down box, don't worry,
your mail is not going to be immediately deleted.

After writing your mails it's probably a good idea to save those, too,
by clicking on the download button for mails in the "Files" tab.

If you're happy with your mails, click "Download Mails" in the "Mails"
tab. This generates the mails for every team and gives you a file
containing the mail each team is supposed to get as well as their mail
addresses.

# Import/export functions

## Teams

The csv file for the teams is probably the most important file since it's
what you need to start with unless you feel like manually adding each
team.
It requires a header, i.e. the first line is a description of what each
field means.
Each field needs to be quoted (surrounded by) double quotation marks and
the separator is a comma.
The required fields are called:

cook1name, cook1last, cook1mail,
cook2name, cook2last, cook2mail, address, phone, comments.

It's info about the two people in the team, their contact info and whatever
comments they have.
So a minimal team csv file could look like this:

`"cook1name","cook1last","cook1mail","cook2name","cook2last","cook2mail","address","phone","comments"
"alice","a","alice@mail.com","bob","b","bob@burger.com","fakestreet 123","123455","vegetarian"`

## Rules

It's just a text file with the same contents of the editor in the "Rules" tab.
Nothing special here.

## Matching

There's two download buttons. One is a custom format that enables you to
share the matching you got with your other organizers. Once you downloaded
this file you can restore that matching by dragging it into the correspondig
field.

The other option is downloading a csv file. You can import that into Excel
or something if you want to check it manually.

## Mails

Since writing and updating those mails takes some time, there's a download
and import option for that, too.
It's a custom format again.
If you absolutely need those mails in plain text, just copy paste them from
the editor.

# Building

Before this website actually works, you need to build it.
You'll need some node modules installed, the build script will tell you which.
In order to build, type into a terminal:

`$ bash build.sh`

# Missing

- Automatic distribution of mails
- Simpler/more robust interface
- Make it not necessarily require building (i.e. better way to inject webworker code)
- Cleaning up the source code

# License

This software is distributed under the MIT license.
