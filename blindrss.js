var globalFeeds = new Array();
var globalRootFeed;
var globalUlEntries;

var curFeed = false;
function min(a, b){{{
	a = parseInt(a);
	b = parseInt(b);
	if (a < b){
		return a;
	}
	return b;
}}}
function max(a, b){{{
	a = parseInt(a);
	b = parseInt(b);
	if (a > b){
		return a;
	}
	return b;
}}}
function resize(){{{
	$("#navigation").height(window.innerHeight-($("#navigation").position().top + 40));
	$("#content").height(window.innerHeight-($("#content").position().top + 60));
}}}
window.onresize=resize;

function rearrangeFeeds(){
	var d = $("#rearrangeFeeds");
	var dBody = d.find(".modal-body");
	var sortedFeeds = globalFeeds.sort(function(a,b){return parseInt(a.data.startID) < parseInt(b.data.startID) ? -1 : 1;}); /* sort by startID ASC */
	/* this sort will leave undefined entries at the end */

	dBody.empty();
	for (var i = 0; i <= sortedFeeds.length; i++){
		var ptr = sortedFeeds[i];
		if (!ptr){
			break;
		}
		if (ptr.isDirectory){
			/* new category */
			var x = $("<li feedID='"+ptr.data.ID+"'>"+ptr.data.name+"<ul id='category_"+ptr.data.ID+"' /></li>").draggable({revert: "invalid"});
			x.find("ul").append($("<div into='"+ptr.data.ID+"'>&nbsp;</div>")
				   .droppable({
					hoverClass: "ui-droppable-hover", 
					greedy: true, 
					tolerance: "pointer",
					drop: function(event, ui){
						$.ajax({
							url: "rest.php/feed/"+ui.draggable.attr("feedID"),
							type: "MOVE",
							dataType: "json",
							data: JSON.stringify({
								moveToBeginningOfCategory: $(this).attr("into")
							}),
							success: function(data){
							},
							complete: function(){
								getFeeds();
								rearrangeFeeds();
							}
						});
				   	}
				   })
			);
			if (i == 0){
				dBody.append(x);
			} else {
				$("#category_"+ptr.parent.data.ID).append(x);
			}
		} else {
			var li = $("<li feedID='"+ptr.data.ID+"'>"+ptr.data.name+"</li>").draggable({revert: "invalid"});
			$("#category_"+ptr.parent.data.ID).append(li);
			li.after($("<div after='"+ptr.data.ID+"'>&nbsp;</div>")
			  .droppable({
				hoverClass: "ui-droppable-hover",
				greedy: true,
				tolerance: "pointer",
				drop: function(event, ui){
					$.ajax({
						url: "rest.php/feed/"+ui.draggable.attr("feedID")+"/move",
						type: "POST",
						dataType: "json",
						data: JSON.stringify({
							moveAfterFeed: $(this).attr("after")
						}),
						success: function(data){
						},
						complete: function(){
							getFeeds();
							rearrangeFeeds();
						}
					});
				}
			  })
			);
		}
	}

	d.modal();
}
function FeedShowSettings(){{{
	var f = this;

	var d = $("#feedSettings");
	d.find("#name").val(f.data.name);
	d.find("#url").val(f.data.url).attr("disabled", f.isDirectory);
	d.find("#isgroup").on("change", function(){ d.find("#url").attr("disabled", $(this).val() == "1"); }).val(f.isDirectory ? "1" : "0");
	d.find("#cacheimages").val(f.data.cacheimages);
	d.find("#deleteFeed").button().on("click", function(){
		if (confirm("Really delete feed? This cannot be undone!")){
			if (parseInt(f.data.startID) == 1){
				alert("Cowardly refusing to delete root category '"+f.data.name+"'");
			}
			else if (parseInt(f.data.endID) - 1 != parseInt(f.data.startID)){ // non-empty category
				alert("Cowardly refusing to delete non-empty category!");
			} else {
				d.dialog("close");
				f.deleteFeed();
			}
		}
	});

	var filter = d.find("#filter");
	filter.empty().spin("tiny");
	$.ajax({
		url: "rest.php/feed/"+f.data.ID+"/filter",
		type: "GET",
		dataType: "json",
		success: function (data){
			var s = "";
			data[data.length] = {ID: 0, regex: "", whiteorblack: "white"};
			$.each(data, function(k,v){
				s += "<tr><td>"+
					"<select name='whiteorblack_"+v.ID+"' id='whiteorblack_"+v.ID+"'>"+
					"<option value='white' "+(v.whiteorblack == "white" ? "selected" : "")+">Whitelist</option>"+
					"<option value='black' "+(v.whiteorblack == "black" ? "selected" : "")+">Blacklist</option>"+
					"</select>"+
					"</td><td>"+
					"<input type='text' value='"+v.regex+"' name='regex_"+v.ID+"'>"+
					"</td><td>"+
					"<label class='checkbox'><input type='checkbox' name='delete_"+v.ID+"' id='delete_"+v.ID+"'>Delete?</label>"+
					"</td></tr>";
			});
			filter.append(s).spin(false);
		},
		complete: function(){ d.find("input[type=radio]").button(); d.find("input[type=checkbox]").button(); }
	});

	$("#buttonSaveChanges").unbind("click");
	$("#buttonSaveChanges").bind("click", function(){ f.updateFeed(); });
	$("#feedSettings").modal();
}}}
function FeedUpdateFeed(){{{
	var f = this;
	var d = $("#feedSettings");
	var filter = new Array();
	$.each(d.find("[name^=regex_]"), function(k,v){
		var id = v.name.split("_")[1];
		var regex = v.value;
		var wob = d.find("input[name=whiteorblack_"+id+"]").val();
		var del = d.find("input[name=delete_"+id+"]").attr("checked") == "checked" ? "true" : "false";
		filter[filter.length] = {ID: id, regex: regex, whiteorblack: wob, delete: del};
	});
	$.ajax({
		url: "rest.php/feed/"+f.data.ID,
		type: "PUT",
		dataType: "json",
		data: JSON.stringify({
			name: d.find("#name").val(),
			url: (d.find("#isgroup").val() == "1" ? "" : d.find("#url").val()),
			cacheimages: d.find("#cacheimages").val(),
			filter: filter
		}),
		success: function(data){
			if (data.status != "OK"){
				alert(data.msg);
				return;
			}
			f.data.name = d.find("#name").val();
			f.data.cacheimages = d.find("input[name=cacheimages]:checked").val();
			f.data.url = d.find("input[name=isgroup]:checked").val() == "1" ? "" : d.find("#url").val();
			f.nameFeed.empty().append(d.find("#name").val());
		},
		complete: function(){
			d.modal("hide");
		}
	});
}}}
function FeedRenderCount(){{{
	var f = this;
	f.numNew.empty();
	if (parseInt(f.data.unreadCount) > 0){
		f.numNew.append(f.data.unreadCount);
		f.ul.addClass("new");
	} else {
		f.ul.removeClass("new");
	}
}}}
function FeedIsDirectory(){{{
	if ("x"+this.data.url == "x" ||
		"x"+this.data.url == "xnull" ||
		"x"+this.data.url == "xundefined"){
		this.isDirectory=returnTrue;
	} else {
		this.isDirectory=returnFalse;
	}
	return this.isDirectory;
}}}
function FeedGetEntries(){{{
	var f = this;

	if (curFeed){
		if (curFeed != this){
			delete(curFeed.entries);
		}
	}
	curFeed = this;

	f.spin.spin("tiny");
	$.ajax({
		url: "rest.php/feed/"+f.data.ID+"/entries/"+f.entry,
		type: "GET",
		dataType: "json",
		success: function(data){
			var e = globalUlEntries;

			$("ul.feed li.active").toggleClass("inactive active");
			f.li.toggleClass("inactive active");
			if (data.length == 0){
				e.find(".loadMore").remove();
				e.append("<li class='loadMore inactive'>[ No more entries ]</li>");
				return;
			}

			var scrollTop = e.parent().parent().scrollTop();
			if (f.entry == 0){
				e.empty();
				e.append("<li class='nav-header'>Feedentries</li>");
				scrollTop = 0;
				f.entries = new Array();
			} else {
				e.find(".loadMore").remove();
			}
			$.each(data, function(k, v){
				v.feed = f;
				f.entries[v.ID] = new Entry(v);
			});

			var li = $("<li class='loadMore inactive' />");
			li.append(
				$("<a href='#'>[ Load 25 more entries ]</a>")
				.on("click", function(){
					f.entry += 25;
					f.getEntries();
				})
			);
			e.append(li);

			if (f.entry == 0){
				e.parent().parent().scrollTop(0);
			} else {
				e.parent().parent().scroll(scrollTop);
			}
		},
		complete: function(){ f.spin.spin(false); globalUlEntries.parent().spin(false); }
	});
}}}
function FeedMarkAllRead(){{{
	var f = this;
	var maxID;

	if (!(maxID = parseInt(f.data.maxID))){
		maxID = 0;
	}

	f.spin.spin("tiny");
	if (f.entries){
		$.each(f.entries, function(k,v){
			if (!v){
				return true;
			}
			maxID = max(maxID, v.data.ID);
		});
	}

	$.ajax({
		url: "rest.php/feed/"+this.data.ID+"/markAllRead",
		dataType: "json",
		type: "POST",
		data: { maxID: maxID },
		complete: function(){ f.updateCount(); },
		success: function(data){
			if (data.status == "OK"){
				globalUlEntries.find("li").removeClass("new");
				f.updateCount();
			} else {
				alert(data.msg);
			}
		}
	});
}}}
function FeedUpdateCount(){{{
	var f = this;
	f.spin.spin("tiny");
	$.ajax({
		url: "rest.php/unreadcount/"+f.data.ID,
		dataType: "json",
		type: "GET",
		complete: function(){ f.spin.spin(false); },
		success: function(data){
			$.each(data, function(k, v){
				var feed = globalFeeds[parseInt(v.ID)];
				feed.data.unreadCount = v.unread;
				feed.data.maxID = v.maxID;
				feed.renderCount();
			})
			for (var x = f.parent; x; x=x.parent){
				/* only need to update parents */
				var newCount = 0;
				for (var c = 0; c < x.children.length; c++){
					newCount += parseInt(x.children[c].data.unreadCount);
				}
				x.data.unreadCount = newCount;
				x.renderCount();
			}
		}
	});
}}}
function FeedDeleteFeed(){{{
	var f = this;
	f.spin.spin("tiny");

	$.ajax({
		url: "rest.php/feed/"+f.data.ID,
		type: "DELETE",
		dataType: "json",
		success: function(data){
			f.spin.spin(false);
			f.ul.parent().remove();
		}
	});
}}}
function Feed(data){{{
	var f = this;
	globalFeeds[parseInt(data.ID)] = this;
	this.data = data;
	this.getEntries=FeedGetEntries;
	this.updateCount=FeedUpdateCount;
	this.markAllRead=FeedMarkAllRead;
	this.renderCount=FeedRenderCount;
	this.showSettings=FeedShowSettings;
	this.deleteFeed=FeedDeleteFeed;
	this.updateFeed=FeedUpdateFeed;
	this.children = new Array();

	/* unfortunately, any of these tend to be sent from the server */
	if ("x"+this.data.url == "x" ||
		"x"+this.data.url == "xnull" ||
		"x"+this.data.url == "xundefined"){
		this.isDirectory=true;
	} else {
		this.isDirectory=false;
	}

	this.ul = $("#feed_"+this.data.startID);
	this.li = $("<li id='details_"+this.data.startID+"' class='inactive' />");
	this.spin = $("<span class='floatLeft spin' id='spinFeed_"+this.data.startID+"'>&nbsp;</span>");
	this.nameFeed = $("<a href='#' class='nameFeed'>"+this.data.name+"</a>");
	this.numNew = $("<a id='numNew_"+this.data.startID+"' class='numNewMessages' />");
	this.nameFeed.append(this.numNew)

	this.buttons = new Object();
	this.buttons.settings = $("<a class='floatRight editButton' href='#'><i class='icon-pencil' /></a>")
		.on("click", function(){
			f.showSettings();
		});
	this.buttons.newMessage = $("<a id='newMessage_"+this.data.startID+"' class='newmessage floatRight' href='#'><i class='icon-envelope' /></a>")
		.on("click", function() {
			f.markAllRead();
		});

	this.li.append(
		$("<div class='floatRight'>").append(this.buttons.settings)
		.append(this.buttons.newMessage)
		.append(this.spin)
	);
	this.li.append(this.nameFeed);
		//$("<div class='nameFeed'>").append(this.nameFeed)
	//);

	this.ul.attr("startID", this.data.startID)
	       .attr("endID",   this.data.endID)
	       .attr("group",   this.data.ID)
	       .append(this.li);
	if (this.isDirectory){
		this.ul.addClass("group");
	} else {
		this.ul.addClass("feed");
		this.nameFeed.on("click", function(){
			f.entry = 0;
			f.getEntries();
		});
	}
}}}

function EntryMarkRead(){{{
	var e = this;
	if (e.data.isread == "1"){
		return;
	}
	e.toggleRead();
}}}
function EntryToggleRead(){{{
	var e = this;
	if (e.data.isread == "1"){
		e.data.isread = "0";
	} else {
		e.data.isread = "1";
	}
	e.render();
	$.ajax({
		url: "rest.php/entry/"+this.data.ID,
		type: "PUT",
		dataType: "json",
		data: JSON.stringify({ isread: e.data.isread }),
		success: function(data){
			if (data.status == "OK"){
				var f;
				for (f = e.data.feed; f; f=f.parent){
					if (e.data.isread == "0"){
						f.data.unreadCount++;
					} else {
						f.data.unreadCount--;
					}
					f.renderCount();
				}
			} else {
				alert(data.msg);
			}
		}
	});
}}}
function EntryShow(){{{
	$("#headline").empty().attr("href", this.data.link).html(this.data.title.replace(/</, "&lt;").replace(/>/, "&gt;"));
	$("#content").empty().html(this.data.description.replace(/<(\/?)script/, "<$1disabledscript"));
	$("ul#entries li.active").toggleClass("inactive active");
	li = $("ul#entries li#entry_"+this.data.ID);
	li.toggleClass("inactive active");
	this.markRead();
}}}
function EntryRender(){{{
	var e = this;
	li = $("ul#entries li#entry_"+e.data.ID);
	if (e.data.isread == "1"){
		li.removeClass("new");
		li.find("i.icon-star").toggleClass("icon-star icon-star-empty");
	} else {
		li.addClass("new");
		li.find("i.icon-star-empty").toggleClass("icon-star icon-star-empty");
	}
}}}
function Entry(data){{{
	var that = this;
	this.data = data;
	this.show = EntryShow;
	this.markRead = EntryMarkRead;
	this.toggleRead = EntryToggleRead;
	this.render = EntryRender;

	var li = $("<li class='inactive' id='entry_"+this.data.ID+"' />");
	if (this.data.isread == "0"){
		li.addClass("new");
	}
	li.append(
		$("<a href='#' class='floatLeft'><i class='icon-"+(this.data.isread == "0" ? "star" : "star-empty")+"'/></a>") /* bug in bootstraps .css? */
		.on("click", function(){
			that.toggleRead();
		})
	);
	li.append(
		$("<a href='#'></a>")
		.append(this.data.title)
		.on("click", function(){
			that.show();
		})
	);
	globalUlEntries.append(li);
}}}

function getFeeds(){{{
	var feed_1 = $("#feed_1");
	feed_1.empty();
	$.ajax({
		url: "rest.php/feeds",
		type: "GET",
		dataType: "json",
		async: false,
		success: function(data){
			if (!data){
				return;
			}
			/* We're cheating a bit to get the first feed */
			globalFeeds = new Array();
			$.each(data, function(k,v){
				if (k == 0){
					globalRootFeed = new Feed(v);
					return true; // continue; // already initialized in static HTML
				}
				var parentFeed = $("ul").filter(function(){
					return  $(this).attr("startID") <= parseInt(v.startID) &&
						$(this).attr("endID")   >= parseInt(v.endID)   &&
						globalFeeds[parseInt($(this).attr("group"))].isDirectory;
				}).last().attr("group");
				parentFeed = globalFeeds[parseInt(parentFeed)];

				parentFeed.ul.append("<li><ul class='nav nav-list' id='feed_"+v.startID+"' /></li>");
				var f = new Feed(v);
				f.parent = parentFeed;
				parentFeed.children[parentFeed.children.length] = f;
			});
		},
	});
}}}
function startup(){{{
	$("input[type=button]").button();
	globalUlEntries = $("ul#entries");
	resize();
	getFeeds();
}}}
$(document).ready(startup);

function showAddFeed(){{{
	var f = this;
	var d = $("<div />").dialog({
		width: "800px",
		modal: true,
		title: "Add Feed",
		close: function(event, ui){
			$(this).remove();
			return true;
		},
		buttons: {
			"FF Handler": addRSSHandler,
			"Commit": function(){ d.dialog("close"); },
			"Cancel": function(){ d.dialog("close"); }
		}
	});
	d.html("<table>"+
		"<tr><td>Parent:</td><td><select id='parent' /></td></tr>"+
		"<tr><td>Name:</td><td><input type='text' size='60' id='name'></td></tr>"+
		"<tr><td>Feed URL:</td><td><input type='text' id='url' size='60'></td></tr>"+
		"<tr><td>Is a group:</td><td id='isGroupYesNo'><input type='radio' id='isgroupno' name='isgroup' checked value='0'><label for='isgroupno'>No</label><input type='radio' id='isgroupyes' name='isgroup' value='1'><label for='isgroupyes'>Yes</label></td></tr>"+
		"<tr><td>Cache images:</td><td id='cacheImagesYesNo'><input type='radio' id='cacheimagesno' name='cacheimages' checked value='no'><label for='cacheimagesno'>No</label><input type='radio' id='cacheimagesyes' name='cacheimages' value='yes'><label for='cacheimagesyes'>Yes</label></td></tr>"+
		"</table>");
	d.find("#isGroupYesNo").buttonset();
	d.find("#cacheImagesYesNo").buttonset();
	d.find("#isgroupyes")
		.on("change", function(){ d.find("#url").attr("disabled", $(this).attr("checked")); });
	d.find("#isgroupno")
		.on("change", function(){ d.find("#url").attr("disabled", !$(this).attr("checked")); });
	var options = "";
	$.each(globalFeeds, function(k,v){
		if (v == undefined){
			return true; // continue;
		}
		if (v.isDirectory){
			var s = "";
			for (var x = v; x; x=x.parent){
				s = "/"+x.data.name+s;
			}
			options += "<option value='"+v.data.ID+"'>"+s+"</option>";
		}
	});
	d.find("select#parent").append(options);
}}}
function addRSSHandler(){{{
	var addDir = $("#parent :selected");
	if (confirm("Add Feed handler to Firefox and place new feeds under "+addDir.text()+"?")){
		var l = window.location;
		var address = l.protocol+"/"+l.hostname+l.pathname.replace("index.html", "")+"add.php?url=%s&parentID="+addDir.val();
		window.navigator.registerContentHandler('application/vnd.mozilla.maybe.feed',address,"blindRSS " + addDir.text().replace(/^.*\//, ""));
	}
}}}
