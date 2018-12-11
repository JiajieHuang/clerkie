var mongoose = require("mongoose");
var TransactionSchema = new mongoose.Schema({
	trans_id:Number,
	user_id:Number,
	name:String,
	amount:Number,
	date:Date,
	is_recurring:Boolean,
	predicted_next_date:Date,
	predicted_next_amount:Number,
	company_name:String,
});
module.exports = mongoose.model("Transaction",TransactionSchema);