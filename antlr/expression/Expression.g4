grammar Expression;

expression:     expr;

expr:   '(' expr ')'    # brackExpr
    |   expr '!'        # factExpr
    |   expr '^' expr   # powExpr
    |   expr '*' expr   # multExpr
    |   expr '/' expr   # divExpr
    |   expr '+' expr   # addExpr
    |   expr '-' expr   # subExpr
    |   number          # numberExpr
    ;
    
number: '0x' INT    # hexNumber
      | '0b' INT    # binNumber
      | INT '_' INT # basedNumber
      | INT         # simpleNumber
      ;
INT     : [0-9]+ ;
NEWLINE : [\r\n]+ -> skip;
WS      : [ \t\r\n]+ -> skip;
ALPHA   : [A-Za-z]+ -> skip;
QOUTES  : ['"]+ -> skip;