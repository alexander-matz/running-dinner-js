let defaults = (function() {
  "use strict";
  const rules = "teams meet once\nways short\n";


  const mailsHelp = `
Just type in whatever you want to your mail to look like.
In order to customize it to whoever it is going to, you can use
variables that then get replaced by their corresponding value.
To use variables, type \$(variable name), so if you'd want to use
the variable 'cook1name' you'd type \$(cook1name).

The available variable are:

recipient1: Name (First and Last) of the first person this mail goes to
recipient2: Same for the second person

starterCookName1: Name of the first person of the cooks of the starter
starterCookName2: ...
starterCookAddress: Address of the host of the starter
starterCookPhone: Phone number of the starter's host
starterCookComments: Comments of the starter's cooks
starterGuest1Name1: Name of first person of the first guest team
starterGuest1Name2: ...
starterGuest1Comments: Comments of the first guest team
starterGuest2Name1: Name of first person of the first guest team
starterGuest2Name2: ...
starterGuest2Comments: Comments of the first guest team

Replace 'starter' with 'main' and 'dessert' to get your variables for
the other dishes.

In order to double check the generated mails, first click 'Download Mails'.
This generates a file that contains all generated emails and the mail addresses
they're intended for. You do NOT send anything by clicking this button.

If you're happy with the generated mails, fill in the email address and the
password you want to send the mails from and click 'Send Mails'.
`.trim();

  const rulesHelp = `
  <h1>Reference</h1>

  A red marker means there is an error with that rule,
  no marker means everything in that line is fine. Just move your mouse
  over the red marker to get an error description.
  <br/>
  <br/>
  <div class="command">teams meet once</div>
  Add HUGE penalty for teams meeting twice or more (always have this on)</br>
  <br/>
  <div class="command">ways short</div>
  Optimize for shortest distance</br>
  <br/>
  <div class="command">ways similar</div>
  Optimize for similar distances</br>
  <br/>
  <div class="command">{team} cooks [starter|main|dessert]</div>
  <div class="command">{team} not cooks [starter|main|dessert]</div>
  Specifies that a team either wants or does not want to cook a specific dish, e.g.:<br/>
  &nbsp;&nbsp; alss cooks starter</br>
  &nbsp;&nbsp; jxfz not cooks main</br>
  </div>
  `.trim();

  const dishes = ['starter', 'main', 'dessert'];

  return {
    rules: () => rules,
    mailsHelp: () => mailsHelp,
    rulesHelp: () => rulesHelp,
    dishes: () => dishes,
  }
})();
