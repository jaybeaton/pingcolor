/* extension.js
 * jaybeaton July 2023
 */

'use strict';

const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Gettext = imports.gettext.domain('PingColor');
const _ = Gettext.gettext;

const UPDTEDLY="update-interval";
const ADDRESS='address';
const LIMIT1 = "limit-1";
const LIMIT2 = "limit-2";
const LIMIT3 = "limit-3";
const LIMIT4 = "limit-4";

let mpingcolor;
let settings;
let feedsArray;
let label;
let tagWatchOUT ;
let tagWatchERR;
let timeout;

const Extension = GObject.registerClass(
class Extension extends PanelMenu.Button{
     _init () {
        super._init(0);

        label = new St.Label({style_class: 'pingcolor-label',y_align: Clutter.ActorAlign.CENTER,text: _("…")});
        let topBox = new St.BoxLayout();
        topBox.add_actor(label);

        this.add_actor(topBox);
        this.buildmenu();
    }

    buildmenu(){
        if (this.mainBox != null)
            this.mainBox.destroy();

        // Create main box
        this.mainBox = new St.BoxLayout();

        let customButtonBox = new St.BoxLayout({
            style_class: 'pingcolor-button-box ',
            vertical: false,
            clip_to_allocation: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            x_expand: true,
            pack_start: false
        });

        // Custom round preferences button.
        let prefsButton = new St.Button();
        prefsButton.child = new St.Icon({
            icon_name: 'emblem-system' ,
            style_class: 'pingcolor-button-action'
        });
        let preflabBtn = new St.Button({style_class: 'pingcolor-button-label',y_align: Clutter.ActorAlign.CENTER,label: _('Settings')});
        prefsButton.connect('clicked', () => {
            this.menu.actor.hide();
            ExtensionUtils.openPrefs();
        });
        preflabBtn.connect('clicked', () => {
            this.menu.actor.hide();
            ExtensionUtils.openPrefs();
        });
        customButtonBox.add_actor(prefsButton);
        customButtonBox.add_actor(preflabBtn);

        this.mainBox.add_actor(customButtonBox);
        this.menu.box.add(this.mainBox);
    }

    loadData() {
        let success;
        this.command = ["ping","-c 1",settings.get_string(ADDRESS)];
        [success, this.child_pid, this.std_in, this.std_out, this.std_err] = GLib.spawn_async_with_pipes(
            null,
            this.command,
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null);

        GLib.close(this.std_in);

        if (!success) {
            label.set_text(_("Ping Failed"));
            return;
        }

        this.IOchannelOUT = GLib.IOChannel.unix_new(this.std_out);
        this.IOchannelERR = GLib.IOChannel.unix_new(this.std_err);

        tagWatchOUT = GLib.io_add_watch(this.IOchannelOUT, GLib.PRIORITY_DEFAULT,
            GLib.IOCondition.IN | GLib.IOCondition.HUP, this.loadPipeOUT );

        tagWatchERR = GLib.io_add_watch(this.IOchannelERR, GLib.PRIORITY_DEFAULT,
            GLib.IOCondition.IN | GLib.IOCondition.HUP,this.loadPipeERR );
    }

     loadPipeOUT(channel, condition, data) {
        if (condition !== GLib.IOCondition.HUP) {
            let out = channel.read_line(); //dummy
            out = channel.read_line();
            const result =  out[1].split('=');
            if(result[3] != null) {
                const val = result[3].split('\n');
                let time = parseFloat(val);
                let timeText = '';
                setlabelstyle(time);
                if (time > 1000) {
                    time = Math.round(time / 100) / 10;
                    timeText = time + 's';
                }
                else {
                    time = Math.round(time);
                    timeText = time + 'ms';
                }
                label.set_text('⬤ ' + timeText);
            }
        }
        else {
           label.set_text(_("❌"));
           label.set_style_class_name('pingcolor-label-error');
        }
        GLib.source_remove(tagWatchOUT);
        channel.shutdown(true);
        //GLib.spawn_close_pid(pid);
    }

    loadPipeERR(channel, condition, data) {
        if (condition != GLib.IOCondition.HUP) {
            label.set_text(_("❌"));
            label.set_style_class_name('pingcolor-label-error');
        }
        GLib.source_remove(tagWatchERR);
        channel.shutdown(false);
        //GLib.spawn_close_pid(pid);
    }
});

function setlabelstyle(time){
    if (time >= settings.get_int(LIMIT4)) {
        label.set_style_class_name('pingcolor-label-error');
    } else if (time >= settings.get_int(LIMIT3)) {
        label.set_style_class_name('pingcolor-label-level-4');
    } else if (time >= settings.get_int(LIMIT2)) {
        label.set_style_class_name('pingcolor-label-level-3');
    } else if (time >= settings.get_int(LIMIT1)) {
        label.set_style_class_name('pingcolor-label-level-2');
    } else {
        label.set_style_class_name('pingcolor-label-level-1');
    }
}

function update() {
    mpingcolor.loadData();
    return GLib.SOURCE_CONTINUE;
}

function init() {
}

function enable() {
    settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.pingcolor');
    mpingcolor = new Extension();
    Main.panel.addToStatusArea('mpingcolor', mpingcolor, 9, 'left');
    timeout=GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE,settings.get_int(UPDTEDLY)*1000, update );
}

function disable() {
    GLib.source_remove(timeout);
    mpingcolor.destroy();
    mpingcolor=null;
    settings=null;
    timeout=null;
    label=null;
    tagWatchOUT =null;
    tagWatchERR=null;
}

