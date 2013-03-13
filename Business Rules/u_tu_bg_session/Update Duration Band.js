update_duration_band();

function update_duration_band() {

   var dura, durs = 0, dur_band = '00';
   dura = current.u_duration.split(':');
   durs = parseInt(dura[0], 10) * 3600;
   durs += parseInt(dura[1], 10) * 60;
   durs += parseInt(dura[2], 10);

   if ( durs < 60 ) {
	  dur_band = '00';
   } else if ( durs < 300 ) {
	  dur_band = '10';
   } else if ( durs < 600 ) {
	  dur_band = '20';
   } else if ( durs < 1800 ) {
	  dur_band = '30';
   } else if ( durs < 3600 ) {
	  dur_band = '40';
   } else {
	  dur_band = '50';
   }

   current.u_duration_band = dur_band;
   
}
