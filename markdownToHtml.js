function makeHtml(text) {
    
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const skipUnrecognized = escaped.replace(/\uFFFD/g, "");

    // count the number of **, it must be even
    var match = skipUnrecognized.match(/\*\*/g)
    var count = match ? match.length : 0;
    var withB = skipUnrecognized;
    if(count % 2 == 0) {
        withB = skipUnrecognized.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    }

    // count the number of ```, it must be even
    var match = withB.match(/```/gm);
    var count = match ? match.length : 0;
    var withPre = withB;
    if(count % 2 == 0) {
        withPre = withB.replace(/```([\s\S]*?)```/g, "<pre>$1</pre>");
    }

    // count the number of ` -- it must be even
    var match = withPre.match(/`/g);
    var count = match ? match.length : 0;
    var withInline = withPre;
    if(count % 2 == 0) {
        withInline = withPre.replace(/`(.*?)`/g, "<code>$1</code>");
    }

    // replace * at the begginning of the line with fancy bullet
    const withBullet = withInline.replace(/^\* /gm, "\u2022 ");

    var res = withBullet;

    return res;
}


module.exports = makeHtml;
