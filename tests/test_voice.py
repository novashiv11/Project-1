"""Voice Jarvis: tap the orb, speak, Jarvis answers in the chat and out loud; briefing on demand."""
import unittest

from tests.test_e2e import PhoneBase

FAKE_VOICE = """
window.__spoken=[];
window.SpeechSynthesisUtterance=function(t){this.text=t};
Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(u){window.__spoken.push(u.text);u.onstart&&u.onstart();setTimeout(()=>u.onend&&u.onend(),10)}}});
window.__say='';
window.SpeechRecognition=window.webkitSpeechRecognition=function(){const r=this;r.start=()=>setTimeout(()=>{
  r.onresult&&r.onresult({results:[[{transcript:window.__say}]]});r.onend&&r.onend()},20);r.stop=()=>{}};
"""


class VoiceJarvisTest(PhoneBase):
    def setUp(self):
        super().setUp()
        self.ctx.add_init_script(FAKE_VOICE)
        self.pg.emulate_media(reduced_motion="reduce")  # the breathing orb never "settles" for clicks otherwise
        self.pg.evaluate("localStorage.setItem('lifeos.settings', '{}'); 0")  # fresh user → Jarvis home
        self.pg.reload()
        self.pg.wait_for_function("typeof items !== 'undefined' && backend")

    def test_talk_to_orb_saves_and_answers_out_loud(self):
        self.pg.evaluate("window.__say='passport expires 2027-03-14'; 0")
        self.pg.click(".jorb")
        self.pg.wait_for_function("items.size === 1")
        self.pg.evaluate("window.__say='passport ka kya scene hai?'; 0")
        self.pg.click(".jorb")
        self.pg.wait_for_function("window.__spoken.some(t => t.includes('passport expires'))")
        self.assertEqual(self.pg.evaluate("items.size"), 1)

    def test_briefing_speaks_today(self):
        self.pg.evaluate("window.__say='dentist aaj 4pm'; 0")
        self.pg.click(".jorb")
        self.pg.wait_for_function("items.size === 1")
        self.pg.click("[data-brief]")
        spoken = self.pg.evaluate("window.__spoken.join(' ')")
        self.assertIn("Aaj 1 kaam: dentist aaj 4pm", spoken)

    def test_voice_reply_can_be_turned_off(self):
        self.pg.evaluate("settings.voiceReply=false; window.__say='kya pending hai?'; 0")
        self.pg.click(".jorb")
        self.pg.wait_for_timeout(300)
        self.assertEqual(self.pg.evaluate("window.__spoken.length"), 0)


if __name__ == "__main__":
    unittest.main()
