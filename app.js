const DAY=86400000;//time of a day
var express= require("express");
var app=express();
var bodyParser =require("body-parser");
var Transaction=require("./models/Transaction");
var mongoose=require("mongoose");
mongoose.connect("mongodb://localhost:27017/interview_challenge",{useNewUrlParser: true, connectTimeoutMS: 10000});
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

function getRecurring(request,response){
	var result;
	var today=new Date(Date.now());
	Transaction.find({is_recurring:true},(err,transactions)=>{
		if (err){
			console.log(err);
			response.status(405).send("database find error");
		}
	}).then(transactions=>{
		var map=groupByNameAndUser(transactions);
		var result=[];
		for (var company_name in map)
		{
			for (var user in map[company_name])
			{
				var isActive=getActivity(map[company_name][user][0].predicted_next_date,today);
				
				var transactions=[];
				for (var i=0;i<map[company_name][user].length;i++)
				{
					var transaction=map[company_name][user][i];
					// if active add it te the list of transactions
					if (isActive){
						transactions.push({trans_id:transaction.trans_id,user_id:user,name:transaction.name,amount:transaction.amount,date:transaction.date});
					}
					// if not set the series of transactions as not recurring
					else{
						Transaction.findByIdAndUpdate(transaction._id,{is_recurring:false},function(err,query){
						});
					}
					
				}
				if (isActive)
				{
					result.push({
						name:company_name,
						user_id:user,
						next_amount:map[company_name][user][0].predicted_next_amount,
						next_date:map[company_name][user][0].predicted_next_date,
						transactions:transactions,
					});	
				}
			}
		}
		result.sort((a,b)=>{return a.name<b.name?-1:1});
		response.status(200).json(result);
	}); 
}

function findRecurringAndUpDate(trans,list){
	//find the recurring transactions and update to DB
	var map=groupByNameAndUser(trans);
	var today=new Date(Date.now());
	list.forEach(function(pair){
			
			var company_name=pair[0];
			var user=pair[1];
			map[company_name][user].sort(compare);
			var collection=map[company_name][user];
			var recurring_transactions=[];
			if (collection.length<2)
			{return;}
			else{
				var gap=collection[1].date-collection[0].date;
				var amount=collection[0].amount;
				var prev=0;
				recurring_transactions.push(collection[0]);
				for (var i=1;i<collection.length;i++)
				{
					//to be recurring the difference between the new gap and old gap shouldn't be more than 7 days.
					 // the difference of the new amount and the old amount should not be more than 30% 
					if (Math.abs(collection[i].date-collection[prev].date-gap)<7*DAY&&Math.abs(collection[i].amount-collection[prev].amount)<0.3*collection[prev].amount)
					{
						recurring_transactions.push(collection[i]);
						gap=collection[i].date-collection[prev].date;
						prev=i;
					}
					else if (collection[i].date-collection[prev].date-gap>7*DAY)
					{
						recurring_transactions=[];
						recurring_transactions.push(collection);	
					}	
				}
				//if find a series of recurring transactions, update their information in database.
				if (recurring_transactions.length>2)
				{
					var predicted_amout=collection[prev].amount;
					var predicted_next_date=new Date(collection[prev].date.getTime()+gap);
					if (today-predicted_next_date<7*DAY)
					{
						for (var j=0;j<recurring_transactions.length;j++)
						{
							updateTransactionToRecurring(recurring_transactions[j],predicted_amout,predicted_next_date);
						}
					}
					
				}
			}
	});
}
function updateTransactionToRecurring(transaction,predicted_next_amount,predicted_next_date){
	var id=transaction._id;
	Transaction.findByIdAndUpdate(id,{predicted_next_amount:predicted_next_amount,predicted_next_date:predicted_next_date,is_recurring:true},function(err,query){
	});
}
function compare(transA,transB)
{
	return transA.date-transB.date;
}
function getActivity(date_predicted,date_today) //to judge if the recurring transaction is still active
{
	// if today's date is in 7 days of predicted next date, we regard it as active
	return date_today-date_predicted<7*DAY;
}
function groupByNameAndUser(transactions)
{
	// group the transactions by company_name and id
	//input: an array of transactions
	var map={};
	transactions.forEach(function(transaction)
	{
		var company_name=transaction["company_name"];
		var user=transaction["user_id"];
		if (!(company_name in map))
		{map[company_name]={};}
		if (!(user in map[company_name]))
		{map[company_name][user]=[];}
		map[company_name][user].push(transaction);
		
	});
	//return a map, in which map[company_name][user] stores all the transactions of company_name :company_name user_id: user
	return map;
}
function getNameAndUserToUpdate(transactions)
{
	//get the list of pairs of company_name and id of all transactions
	//input: an array of transactions
	var list=[];
	transactions.forEach(function(transaction)
	{
        list.push([transaction.company_name,transaction.user_id]);
	});
	//return list of {company_name, user_id}
	return list;
}
function findCompanyName(name)
{
	//
	var company_name='';
	var split=name.split(" ");
	for (var index in split)
	{
		if (!(/\d/.test(split[index]))) {
			company_name+=split[index] + ' ';
		} else {
			break;
		}
	}
	return company_name.trim();
}
var PORT=1984;
app.get("/",function(request,response){
	getRecurring(request,response);
});
app.post("/",function(request,response){
		var transactions=request.body;
		//insert company_name to transactions
		transactions.forEach(function(transaction){
			transaction.company_name=findCompanyName(transaction.name);
			
		});
		var list=getNameAndUserToUpdate(transactions);
		Transaction.insertMany(transactions).then(()=>{
			Transaction.find({},function(err,trans){			
				findRecurringAndUpDate(trans,list);
				getRecurring(request,response);
			}
		);
	});
});
app.listen(PORT,'localhost',()=>{
	console.log("The app is listening on localhost port "+PORT);
});