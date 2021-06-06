import ExpressionListener from './expression/ExpressionListener.js';

export default class ExpressionEvaluator extends ExpressionListener {

    constructor() {
        super();
        this.results = {};
    }
    
    // Enter a parse tree produced by ExpressionParser#expression.
	enterExpression(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#expression.
    exitExpression(ctx) {
        this.results[ctx] = parseInt(this.results[ctx.expr()]);
	}


	// Enter a parse tree produced by ExpressionParser#addExpr.
	enterAddExpr(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#addExpr.
	exitAddExpr(ctx) {
        this.results[ctx] =  this.results[ctx.expr(0)] + this.results[ctx.expr(1)];
	}


	// Enter a parse tree produced by ExpressionParser#brackExpr.
	enterBrackExpr(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#brackExpr.
	exitBrackExpr(ctx) {
        this.results[ctx] =  this.results[ctx.expr(0)];
	}


	// Enter a parse tree produced by ExpressionParser#divExpr.
	enterDivExpr(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#divExpr.
	exitDivExpr(ctx) {
        this.results[ctx] =  this.results[ctx.expr(0)] / this.results[ctx.expr(1)];
	}


	// Enter a parse tree produced by ExpressionParser#powExpr.
	enterPowExpr(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#powExpr.
	exitPowExpr(ctx) {
        this.results[ctx] =  Math.pow(this.results[ctx.expr(0)], this.results[ctx.expr(1)]);
	}
    
    // Enter a parse tree produced by ExpressionParser#factExpr.
	enterFactExpr(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#factExpr.
	exitFactExpr(ctx) {
        let result = 1;
        let evaluatedTreeNode = parseInt(this.results[ctx.expr(0)])
        if (!evaluatedTreeNode) return undefined;
        for (let i = 1; i < evaluatedTreeNode + 1; i++)
            result *= i;
        this.results[ctx] = result;
	}


	// Enter a parse tree produced by ExpressionParser#subExpr.
	enterSubExpr(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#subExpr.
	exitSubExpr(ctx) {
        this.results[ctx] =  this.results[ctx.expr(0)] - this.results[ctx.expr(1)];
	}


	// Enter a parse tree produced by ExpressionParser#multExpr.
	enterMultExpr(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#multExpr.
	exitMultExpr(ctx) {
        this.results[ctx] =  this.results[ctx.expr(0)] * this.results[ctx.expr(1)];
	}
    
    
    
    // Enter a parse tree produced by ExpressionParser#numberExpr.
	enterNumberExpr(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#numberExpr.
	exitNumberExpr(ctx) {
        this.results[ctx] = this.results[ctx.number()];
	}
    
    // Enter a parse tree produced by ExpressionParser#hexNumber.
	enterHexNumber(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#hexNumber.
	exitHexNumber(ctx) {
        this.results[ctx] = parseInt(ctx.INT().getText(), 16);
	}
    
    // Enter a parse tree produced by ExpressionParser#binNumber.
	enterBinNumber(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#binNumber.
	exitBinNumber(ctx) {
        this.results[ctx] = parseInt(ctx.INT().getText(), 2);
	}

	// Enter a parse tree produced by ExpressionParser#basedNumber.
	enterBasedNumber(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#basedNumber.
	exitBasedNumber(ctx) {
        this.results[ctx] = parseInt(ctx.INT(0).getText(), ctx.INT(1).getText());
	}


	// Enter a parse tree produced by ExpressionParser#simpleNumber.
	enterSimpleNumber(ctx) {
	}

	// Exit a parse tree produced by ExpressionParser#simpleNumber.
	exitSimpleNumber(ctx) {
        this.results[ctx] = parseInt(ctx.INT().getText());
	}
}
